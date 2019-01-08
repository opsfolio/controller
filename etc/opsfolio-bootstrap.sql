CREATE TABLE opsfolio_raci_matrix(
    id serial PRIMARY KEY,
    asset VARCHAR (255) NOT NULL,
    asset_responsible VARCHAR (255) NOT NULL,
    asset_accountable VARCHAR (255) NOT NULL,
    asset_informed VARCHAR (255) NOT NULL
);



CREATE TABLE opsfolio_asset_risk(
    id serial PRIMARY KEY,
    asset VARCHAR (255) NOT NULL,
    threat_event VARCHAR (255) NOT NULL,
    threat_source VARCHAR (255) NOT NULL,
    relevance VARCHAR (255) NOT NULL,
    likelihood VARCHAR (255) NOT NULL,
    impact VARCHAR (255) NOT NULL,
    risk VARCHAR (255) NOT NULL
);

