local rsmf = import "rsmf.libsonnet";
local columnTypes = rsmf.columnTypes;
local tableTypes = rsmf.tableTypes;

local opsfolioDBHome = "/var/lib/opsfolio";

local core = {
    databaseName : "opsfolio-core",
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
    "core.sql" : 
        "PRAGMA foreign_keys = ON;\n\n" +
        rsmf.createTablesSQL(core) +
        rsmf.createDataSQL(core),

    "osquery-config.json" : rsmf.osQueryConfigATC(core, opsfolioDBHome + "/%(databaseName)s.db"),

    "create-opsfolio-db-and-configure-osquery.sh" : |||
        rm %(opsfolioDBHome)s/opsfolio-core.db
        cat core.sql | sqlite3 %(opsfolioDBHome)s/opsfolio-core.db
        osqueryi --verbose --config_path osquery-config.json
    ||| % { opsfolioDBHome : opsfolioDBHome }
}