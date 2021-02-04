import {
  contextMgr as cm,
  govnImCore as gimc,
  govnImRDS as rds,
  govnImRDSModels as models,
  govnImTypical as gimTyp,
  namespaceMgr as ns,
} from "./deps.ts";
import * as boundary from "./boundary.ts";

class CommonModelStructure extends gimTyp.TypicalInfoModelStructure {
  readonly namespace: ns.Namespace;
  readonly entities: gimc.Entity[];
  readonly partyF: models.PartyFactory;
  readonly orgF: models.OrganizationFactory;
  readonly personF: models.PersonFactory;
  readonly contactF: models.ContactFactory;
  readonly accountF: models.AccountFactory;
  readonly configFFF: models.ConfigFeatureFlagFactory;
  readonly boundaryFF: boundary.BoundaryFactory;

  constructor(readonly params: gimTyp.TypicalInfoModelStructParams) {
    super(params);

    this.partyF = new models.PartyFactory(params);
    const partyRelatedInfoModelParams = {
      ...params,
      partyFactory: this.partyF,
    };

    this.contactF = new models.ContactFactory(partyRelatedInfoModelParams);
    const contactRelatedInfoModelParams = {
      ...partyRelatedInfoModelParams,
      contactFactory: this.contactF,
    };

    this.orgF = new models.OrganizationFactory(contactRelatedInfoModelParams);
    this.personF = new models.PersonFactory(contactRelatedInfoModelParams);
    this.accountF = new models.AccountFactory(params);
    this.configFFF = new models.ConfigFeatureFlagFactory(
      partyRelatedInfoModelParams,
    );
    this.boundaryFF = new boundary.BoundaryFactory(partyRelatedInfoModelParams);
    this.namespace = params.entityParams.namespace;
    this.entities = [
      ...params.prependEntities,
      this.partyF.partyType,
      this.partyF.party,
      this.partyF.partyIdentifierSource,
      this.partyF.partyIdentifier,
      this.partyF.partyRelationType,
      this.partyF.partyRelation,
      this.orgF.orgType,
      this.orgF.organization,
      this.personF.spokenLanguage,
      this.personF.personEducationLevel,
      this.personF.personType,
      this.personF.personGender,
      this.personF.person,
      this.personF.personDemogrTypeDefn,
      this.personF.personDemogrView,
      this.personF.createPersonDemographicsProc,
      this.contactF.contactType,
      this.contactF.electronic,
      this.contactF.land,
      this.contactF.telephonic,
      this.accountF.accountType,
      this.accountF.accountAuthType,
      this.accountF.account,
      this.accountF.accountIdentifier,
      this.configFFF.configurationScope,
      this.configFFF.masterConfiguration,
      this.configFFF.configurationValue,
      this.configFFF.configurationMasterOptions,
      this.configFFF.configurationFeatureFlag,
      this.boundaryFF.boundaryScope,
      this.boundaryFF.boundary,
      ...params.appendEntities,
    ];
    this.finalize();
  }
}

class CommonModelContent extends gimTyp.TypicalInfoModelContent {
  constructor(struct: CommonModelStructure) {
    super(struct);

    const acct = struct.accountF.account;
    const acctIdf = struct.accountF.accountIdentifier;
    this.addContent(
      cm.ctxFactory.envTest,
      acct,
      acct.accountName.value("Service"),
      acct.accountType.value(models.AccountType.values.SERVICE),
    );
    this.addAttrValues(
      cm.ctxFactory.envTest,
      {
        isRowCompatibleWithEngine: (
          ctx: rds.RdbmsEngineContext,
        ): boolean => {
          return ctx.isPostgreSQL;
        },
        entity: acctIdf,
        attrValues: [
          acctIdf.account.value(
            rds.interpolatedLiteralSQL({
              sql: `(select {acct:identity} 
                  from {acct} 
                 where {acct:accountName} = 'Service')`,
              with: { acct: acct },
              emitAsSingleLine: true,
            }),
          ),
          acctIdf.identifierName.value("id_name"),
          acctIdf.identifierValue.value("test"),
          acctIdf.identifierValueEncrypted.value("test"),
          acctIdf.accountAuthType.value(models.AccountAuthType.values.EMAIL),
        ],
      } as rds.RdbmsRowValues<models.AccountIdentifier>,
    );
  }
}

export class CommonModel extends gimTyp.TypicalInformationModel {
  readonly structParams: gimTyp.TypicalInfoModelStructParams;
  readonly structure: CommonModelStructure;

  constructor() {
    super();

    this.structParams = new models.DefaultInfoModelStructParams(
      ns.namespaceFactory.namespace("opsfolio"),
    );
    this.structure = new CommonModelStructure(this.structParams);
    this.addContent(
      new CommonModelContent(this.structure),
    );
  }
}

export default CommonModel;
