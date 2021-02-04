import {
  govnImCore as gimc,
  govnImRDSModels as models,
  govnImTypical as gimTyp,
} from "./deps.ts";

export class BoundaryScope extends gimTyp.TypicalPersistentEntity {
  readonly party: gimc.BelongsTo<models.Party>;
  readonly scopeCode: gimc.Text;
  readonly scopeName: gimc.Text;
  readonly description: gimc.Text;
  readonly hierarchyLevel: gimc.Integer;

  constructor(
    params: models.PartyRelatedInfoModelParams,
  ) {
    super(
      gimc.entityName("boundary_scope"),
      params.entityParams,
    );
    this.party = params.partyFactory.party.createBelongsToRel(this);
    this.scopeCode = this.text("code");
    this.scopeName = this.text("friendly_name");
    this.description = this.text("description");
    this.hierarchyLevel = this.integer("hierarchy_level");
    this.insertAttrs(
      this.party,
      this.scopeCode,
      this.scopeName,
      this.description,
      this.hierarchyLevel,
    );
  }
}

export class Boundary extends gimTyp.TypicalPersistentEntity {
  readonly party: gimc.BelongsTo<models.Party>;
  readonly parent: gimc.SelfReference<Boundary>;
  readonly boundaryScope: gimc.BelongsTo<BoundaryScope>;
  readonly boundaryName: gimc.Text;
  readonly description: gimc.Text;
  readonly friendlyName: gimc.Text;
  readonly nature: gimc.Text;

  constructor(
    readonly configurationScopeEntity: BoundaryScope,
    params: models.PartyRelatedInfoModelParams,
  ) {
    super(
      gimc.entityName("boundary"),
      params.entityParams,
    );
    this.party = params.partyFactory.party.createBelongsToRel(this);
    this.boundaryScope = this.configurationScopeEntity.createBelongsToRel(
      this,
    );
    this.parent = this.createSelfRef(
      gimc.attributeName("parent_boundary_id", "parent_boundary"),
    );
    this.boundaryName = this.text("name");
    this.description = this.text("description");
    this.friendlyName = this.text("friendly_name");
    this.nature = this.text("nature");

    this.insertAttrs(
      this.party,
      this.boundaryScope,
      this.parent,
      this.boundaryName,
      this.description,
      this.friendlyName,
      this.nature,
    );
  }
}

export class BoundaryFactory {
  readonly boundaryScope: BoundaryScope;
  readonly boundary: Boundary;

  constructor(params: models.PartyRelatedInfoModelParams) {
    this.boundaryScope = new BoundaryScope(params);
    this.boundary = new Boundary(
      this.boundaryScope,
      params,
    );
  }
}
