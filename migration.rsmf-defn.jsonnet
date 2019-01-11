local context = import "context.rsmf-facts.json";
local rsmf = import "rsmf.libsonnet";
local columnTypes = rsmf.columnTypes;
local tableTypes = rsmf.tableTypes;

local opsfolioDBHome = context.migrationDefnHome;
local opsfolioCoreDBName = "opsfolio-core";
local osQueryConfigSuffix = "-osquery-config.json";
local osQueryHome ="/etc/osquery";
local opsfolioDirectory = "/opt/opsfolio";

local core = {
    databaseName : opsfolioCoreDBName,
    tables : [
        tableTypes.enum('opsfolio_asset_risk_type', [
            { code: 'one', value : 'One', abbrev: 'one' },
        ]),

        tableTypes.typical('opsfolio_raci_matrix', [
            columnTypes.identity(),
            columnTypes.text('asset', required=true),
            columnTypes.text('responsible'),
            columnTypes.text('accountable'),
            columnTypes.text('consulted'),
            columnTypes.text('informed'),
        ]),

        tableTypes.typical('opsfolio_asset_risk', [
            columnTypes.identity(),
            columnTypes.enum('opsfolio_asset_risk_type', name = 'asset_risk_type_id', required=true),
            columnTypes.text('threat_event'),
            columnTypes.text('relevance'),
            columnTypes.text('likelihood'),
            columnTypes.text('impact'),
            columnTypes.text('risk')
        ]),
    ],
    data : import "opsfolio-core.rsmf-data.jsonnet"
};

{
    [opsfolioCoreDBName + ".sql"] : 
        "PRAGMA foreign_keys = ON;\n\n" +
        rsmf.createTablesSQL(core) +
        rsmf.createDataSQL(core),

    [opsfolioCoreDBName + osQueryConfigSuffix] : rsmf.osQueryConfigATC(core, opsfolioDBHome + "/%(databaseName)s.db"),

    [context.makeFile.customTargetsIncludeFile] : |||
        # Delete the %(opsfolioCoreDBName)s SQLite database
        clean-%(opsfolioCoreDBName)s-db:
        	$(call logInfo,Deleted $(YELLOW)%(opsfolioDBHome)s/%(opsfolioCoreDBName)s.db$(RESET) SQLite database)
        	rm -f "%(opsfolioDBHome)s/%(opsfolioCoreDBName)s.db"

        # Create the %(opsfolioCoreDBName)s SQLite database
        create-%(opsfolioCoreDBName)s-db: clean-%(opsfolioCoreDBName)s-db
        	$(call logInfo,Created SQLite database $(YELLOW)%(opsfolioDBHome)s/%(opsfolioCoreDBName)s.db$(RESET))
        	cat %(opsfolioCoreDBName)s.sql | sqlite3 "%(opsfolioDBHome)s/%(opsfolioCoreDBName)s.db"

        # Remove the %(opsfolioCoreDBName)s osQuery ATC configuration
        clean-%(opsfolioCoreDBName)s-osquery-ATC-config:
        	$(call logInfo,Removed $(YELLOW)%(osQueryConfigDPath)s/%(opsfolioCoreDBName)s%(osQueryConfigSuffix)s$(RESET) osQuery ATC configuration)
        	sudo rm -f "%(osQueryConfigDPath)s/%(opsfolioCoreDBName)s%(osQueryConfigSuffix)s"

        # Create the %(opsfolioCoreDBName)s osQuery ATC configuration
        create-%(opsfolioCoreDBName)s-osquery-ATC-config: clean-%(opsfolioCoreDBName)s-osquery-ATC-config
        	$(call logInfo,Created $(YELLOW)%(osQueryConfigDPath)s/%(opsfolioCoreDBName)s%(osQueryConfigSuffix)s$(RESET) osQuery ATC configuration)
        	sudo ln -sf "%(osQueryConfigDPath)s/%(opsfolioCoreDBName)s%(osQueryConfigSuffix)s" "%(migrationDefnHome)s/%(opsfolioCoreDBName)s%(osQueryConfigSuffix)s"
        	$(call logInfo,Restarted osQuery)
        	sudo /etc/init.d/osqueryd restart

        ## Create the Opsfolio database(s)
        create-db: create-%(opsfolioCoreDBName)s-db

        ## Setup osQuery with Opsfolio ATCs
        create-osQuery-ATC: create-%(opsfolioCoreDBName)s-osquery-ATC-config

        ## Create the Opsfolio database and create osQuery ATC configuration
        opsfolio: create-db create-osQuery-ATC
    ||| % { 
        opsfolioDirectory : opsfolioDirectory, 
        osQueryHome : osQueryHome,
        osQueryConfigSuffix : osQueryConfigSuffix,
        opsfolioDBHome : opsfolioDBHome, 
        opsfolioCoreDBName : opsfolioCoreDBName,
        osQueryConfigDPath : context.osQuery.configDPath,
        migrationDefnHome : context.migrationDefnHome
    },
}
