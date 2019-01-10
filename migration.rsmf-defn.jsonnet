local context = import "context.rsmf-facts.json";
local rsmf = import "rsmf.libsonnet";
local columnTypes = rsmf.columnTypes;
local tableTypes = rsmf.tableTypes;

local opsfolioDBHome = context.migrationDefnHome;
local opsfolioCoreDBName = "opsfolio-core";
local osQueryConfigSuffix = "-osquery-config.json";

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

    ["create-" + opsfolioCoreDBName + "-db.sh"] : |||
        echo "Removing existing %(opsfolioDBHome)s/%(opsfolioCoreDBName)s.db, if any."
        rm -f "%(opsfolioDBHome)s/%(opsfolioCoreDBName)s.db"
        echo "Creating SQLite database %(opsfolioDBHome)s/%(opsfolioCoreDBName)s.db."
        cat %(opsfolioCoreDBName)s.sql | sqlite3 "%(opsfolioDBHome)s/%(opsfolioCoreDBName)s.db"
    ||| % { opsfolioDBHome : opsfolioDBHome, opsfolioCoreDBName : opsfolioCoreDBName, osQueryConfigSuffix : osQueryConfigSuffix },

    ["configure-" + opsfolioCoreDBName + "-osquery-ATC.sh"] : |||
        echo "Saving configuration into osQuery."
        osqueryi --verbose --config_path %(opsfolioCoreDBName)s-%(osQueryConfigSuffix)s
    ||| % { opsfolioDBHome : opsfolioDBHome, opsfolioCoreDBName : opsfolioCoreDBName, osQueryConfigSuffix : osQueryConfigSuffix },
}