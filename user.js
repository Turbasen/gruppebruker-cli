'use strict';

const opts = require('nomnom')
  .option('group', {
    abbr: 'g',
    help: 'Group ID (Nasjonal Turbase)',
    required: true,
  })
  .option('name', {
    abbr: 'n',
    help: 'User name',
    required: true,
  })
  .option('email', {
    abbr: 'e',
    help: 'User email',
    required: true,
  })
  .option('ntb-api-env', {
    help: 'API environment',
    choices: ['api', 'dev'],
    default: 'dev',
  })
  .option('version', {
    flag: true,
    help: 'Print version and exit',
    callback: function() {
       return 'Version 1.0.0';
    }
  })
  .help('Utility to create user group users')
  .parse();

process.env.NTB_API_ENV = opts['ntb-api-env'];
const turbasen = require('turbasen');
const auth = require('turbasen-auth');
const passord = require('passord');
const sendgrid = require('sendgrid')(process.env.SENDGRID_API_KEY);
const read = require('fs').readFileSync;

turbasen.grupper.get(opts.group, (err, res, group) => {
  if (err) { throw err; }
  if (res.statusCode !== 200) { throw new Error('Group Not Found'); }

  const password = passord();
  auth.createUserAuth(opts.name, opts.email, password, (err, user) => {
    if (err) { throw err; }

    const patch = { '$push': { 'privat.brukere': user }};
    turbasen.grupper.patch(opts.group, patch, (err, res, body) => {
      if (err) { throw err; }
      if (res.statusCode !== 200) { throw new Error('Group Patch Failed'); }

      if (process.env.NTB_API_ENV !== 'api') {
        return console.log('Dev mode detected. Skipping email notfication.');
      }

      var email = new sendgrid.Email();
      email.addTo(opts.email);
      email.subject = 'Velkommen til UT.no';
      email.from = 'hjelp@dnt.no';

      email.html = read('./templates/new-user.txt', 'utf-8');
      email.html = email.html.replace('{{ NAME }}', opts.name);
      email.html = email.html.replace('{{ GROUP }}', group.navn);
      email.html = email.html.replace('{{ USER }}', opts.email);
      email.html = email.html.replace('{{ PASSWORD }}', password);
      email.text = email.html.replace(/<[^>]+>/g, '');

      email.addFilter('templates', 'enable', 1);
      email.addFilter('templates', 'template_id', process.env.SENDGRID_TEMPLATE_ID);
      email.addCategory('utno');
      email.addCategory('gruppe');
      email.addCategory('bruker');

      sendgrid.send(email, (err, json) => {
        if (err) { throw err; }
        console.log('Done!');
      });
    });
  });
});

process.on('SIGINT', process.exit.bind(process, 1));
