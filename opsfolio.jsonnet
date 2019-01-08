local opsfolioConfigHome = "/etc/opsfolio";
local opsfolioDBHome = "/var/lib/opsfolio";
local opsfolioDatabase = opsfolioDBHome + "/opsfolio-core.db";
local opsfolioMigrations = opsfolioConfigHome + "/opsfolio-bootstrap.sql";
local opsfolioOsQueryConfig =  opsfolioConfigHome + "/opsfolio-osquery.conf.json";

{
"create-opsfolio-db-and-configure-osquery.sh" : |||
     cd %(opsfolioDBHome)s
     rm %(opsfolioDatabase)s
     cat %(opsfolioMigrations)s | sqlite3 %(opsfolioDatabase)s
     osqueryi --verbose --config_path %(opsfolioOsQueryConfig)s
 ||| % { opsfolioDBHome : opsfolioDBHome, opsfolioDatabase : opsfolioDatabase, opsfolioMigrations : opsfolioMigrations, opsfolioOsQueryConfig: opsfolioOsQueryConfig }
}

