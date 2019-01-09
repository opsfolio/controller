# Opsfolio osQuery ATC
Opsfolio is an [RSMF](https://github.com/shah/rdbms-schema-migration-framework) based schema migration configuration built for osQuery ATC to 
help manage custom properties useful for managing operational portfolios.

## Setup

First, install [RSMF](https://github.com/shah/rdbms-schema-migration-framework).

Then, symlink the RSMF/lib/Makefile in the root folder

  ln -s /opt/rdbms-schema-migration-framework/lib/Makefile .

Finally, run "make configure" to create the schema migration files.

  make configure

TODO: Elaborate this README with more details
TODO: Setup simple bash scripts and ansible playbook to install Opsfolio on any osQuery server

## Usage

Open the opsfolio-core.rsmf-data.jsonnet file and add/edit data, then run make configure:

  vi opsfolio-core.rsmf-data.jsonnet
  make configure
  
