"use strict";

exports.__esModule = true;

var _extends2 = require("babel-runtime/helpers/extends");

var _extends3 = _interopRequireDefault(_extends2);

exports.inferInputObjectStructureFromFields = inferInputObjectStructureFromFields;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const {
  GraphQLInputObjectType,
  GraphQLBoolean,
  GraphQLString,
  GraphQLFloat,
  GraphQLInt,
  GraphQLID,
  GraphQLList,
  GraphQLEnumType,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType
} = require(`graphql`);

const _ = require(`lodash`);
const report = require(`gatsby-cli/lib/reporter`);
const createTypeName = require(`./create-type-name`);
const createKey = require(`./create-key`);

function makeNullable(type) {
  if (type instanceof GraphQLNonNull) {
    return type.ofType;
  }
  return type;
}

function convertToInputType(type, typeMap) {
  // track types already processed in current tree, to avoid infinite recursion
  if (typeMap.has(type)) {
    return null;
  }
  const nextTypeMap = new Set([...typeMap, type]);

  if (type instanceof GraphQLScalarType || type instanceof GraphQLEnumType) {
    return type;
  } else if (type instanceof GraphQLObjectType) {
    const fields = _.transform(type.getFields(), (out, fieldConfig, key) => {
      const type = convertToInputType(fieldConfig.type, nextTypeMap);
      if (type) out[key] = { type };
    });
    if (Object.keys(fields).length === 0) {
      return null;
    }
    return new GraphQLInputObjectType({
      name: createTypeName(`${type.name}InputObject`),
      fields
    });
  } else if (type instanceof GraphQLList) {
    let innerType = convertToInputType(type.ofType, nextTypeMap);
    return innerType ? new GraphQLList(makeNullable(innerType)) : null;
  } else if (type instanceof GraphQLNonNull) {
    let innerType = convertToInputType(type.ofType, nextTypeMap);
    return innerType ? new GraphQLNonNull(makeNullable(innerType)) : null;
  } else {
    let message = type ? `for type: ${type.name}` : ``;
    if (type instanceof GraphQLInterfaceType) {
      message = `GraphQLInterfaceType not yet implemented ${message}`;
    } else if (type instanceof GraphQLUnionType) {
      message = `GraphQLUnionType not yet implemented ${message}`;
    } else {
      message = `Invalid input type ${message}`;
    }
    report.verbose(message);
  }

  return null;
}

const scalarFilterMap = {
  Int: {
    eq: { type: GraphQLInt },
    ne: { type: GraphQLInt }
  },
  Float: {
    eq: { type: GraphQLFloat },
    ne: { type: GraphQLFloat }
  },
  ID: {
    eq: { type: GraphQLID },
    ne: { type: GraphQLID }
  },
  String: {
    eq: { type: GraphQLString },
    ne: { type: GraphQLString },
    regex: { type: GraphQLString },
    glob: { type: GraphQLString }
  },
  Boolean: {
    eq: { type: GraphQLBoolean },
    ne: { type: GraphQLBoolean }
  }
};

function convertToInputFilter(prefix, type) {
  if (type instanceof GraphQLScalarType) {
    const name = type.name;
    const fields = scalarFilterMap[name];

    if (fields == null) return null;
    return new GraphQLInputObjectType({
      name: createTypeName(`${prefix}Query${name}`),
      fields: fields
    });
  } else if (type instanceof GraphQLInputObjectType) {
    return new GraphQLInputObjectType({
      name: createTypeName(`${prefix}{type.name}`),
      fields: _.transform(type.getFields(), (out, fieldConfig, key) => {
        const type = convertToInputFilter(`${prefix}${_.upperFirst(key)}`, fieldConfig.type);
        if (type) out[key] = { type };
      })
    });
  } else if (type instanceof GraphQLList) {
    const innerType = type.ofType;
    const innerFilter = convertToInputFilter(`${prefix}ListElem`, innerType);
    const innerFields = innerFilter ? innerFilter.getFields() : {};

    return new GraphQLInputObjectType({
      name: createTypeName(`${prefix}QueryList`),
      fields: (0, _extends3.default)({}, innerFields, {
        in: { type: new GraphQLList(innerType) }
      })
    });
  } else if (type instanceof GraphQLNonNull) {
    return convertToInputFilter(prefix, type.ofType);
  }

  return null;
}

function extractFieldNamesFromInputField(prefix, type, accu) {
  if (type instanceof GraphQLScalarType || type instanceof GraphQLList) {
    accu.push(prefix);
  } else if (type instanceof GraphQLInputObjectType) {
    _.each(type.getFields(), (fieldConfig, key) => {
      extractFieldNamesFromInputField(`${prefix}___${key}`, fieldConfig.type, accu);
    });
  } else if (type instanceof GraphQLNonNull) {
    extractFieldNamesFromInputField(prefix, type.ofType, accu);
  }
}

// convert output fields to output fields and a list of fields to sort on
function inferInputObjectStructureFromFields({
  fields,
  typeName = ``
}) {
  const inferredFields = {};
  const sort = [];

  _.each(fields, (fieldConfig, key) => {
    const inputType = convertToInputType(fieldConfig.type, new Set());
    const inputFilter = inputType && convertToInputFilter(_.upperFirst(key), inputType);

    if (!inputFilter) return;

    inferredFields[createKey(key)] = { type: inputFilter

      // Add sorting (but only to the top level).
    };if (typeName) {
      extractFieldNamesFromInputField(key, inputType, sort);
    }
  });

  return { inferredFields, sort };
}
//# sourceMappingURL=infer-graphql-input-fields-from-fields.js.map