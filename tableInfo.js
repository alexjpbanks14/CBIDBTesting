const COLUMN_TYPES = {
  NUMBER_NULL: {
    SToV: (v) => (v == null ? null : Number(v))
  },
  NUMBER: {
    SToV: (v) => Number(v)
  },
  STRING: (l) => ({
    SToV: (v) => {
      return String(v);
    }
  }),
  STRING_NULL: (l) => ({
    SToV: (v) => {
      return v == null ? null : String(v);
    }
  }),
  BOOLEAN: {
    SToV: (v) => Boolean(v)
  }
}

const userTableInfo = {
  tableName: 'USERS',
  createStatement: 'CREATE TABLE IF NOT EXISTS USERS(userID int NOT NULL AUTO_INCREMENT, username VARCHAR(100) NOT NULL, passhash VARCHAR(100), PRIMARY KEY(userID))',
  pk: 'userID',
  columns: [
    { key: 'userID', type: COLUMN_TYPES.NUMBER },
    { key: 'username', type: COLUMN_TYPES.STRING(100) },
    { key: 'passhash', type: COLUMN_TYPES.STRING(100) }
  ]
};
const sessionTableInfo = {
  tableName: 'SESSIONS',
  createStatement: 'CREATE TABLE IF NOT EXISTS SESSIONS(sessionID int NOT NULL AUTO_INCREMENT, sessionKey VARCHAR(50) NOT NULL, passhash VARCHAR(31), PRIMARY KEY(userID))',
  pk: 'userID',
  columns: [
    { key: 'userID', type: COLUMN_TYPES.NUMBER },
    { key: 'username', type: COLUMN_TYPES.STRING(50) },
    { key: 'passhash', type: COLUMN_TYPES.STRING(31) }
  ]
};
const restrictionGroupTableInfo = {
  tableName: 'RESTRICTION_GROUPS',
  createStatement: 'CREATE TABLE IF NOT EXISTS RESTRICTION_GROUPS(groupID int NOT NULL AUTO_INCREMENT, title varchar(255), displayOrder int, PRIMARY KEY (groupID))',
  pk: 'groupID',
  columns: [
    { key: 'groupID', type: COLUMN_TYPES.NUMBER },
    { key: 'title', type: COLUMN_TYPES.STRING(255) },
    { key: 'displayOrder', type: COLUMN_TYPES.NUMBER }
  ]
};
const restrictionTableInfo = {
  tableName: 'RESTRICTIONS',
  createStatement: 'CREATE TABLE IF NOT EXISTS RESTRICTIONS(restrictionID int NOT NULL AUTO_INCREMENT, imageID int, title varchar(255), message varchar(500), groupID int, active BOOLEAN, textColor varchar(10), backgroundColor varchar(10), fontWeight varchar(30), displayOrder int, isPriority BOOLEAN, PRIMARY KEY (restrictionID), FOREIGN KEY(groupID) REFERENCES RESTRICTION_GROUPS(groupID) ON DELETE CASCADE, FOREIGN KEY(imageID) REFERENCES IMAGES(imageID) ON DELETE CASCADE)',
  pk: 'restrictionID',
  columns: [
    { key: 'restrictionID', type: COLUMN_TYPES.NUMBER },
    { key: 'imageID', type: COLUMN_TYPES.NUMBER_NULL },
    { key: 'title', type: COLUMN_TYPES.STRING(255) },
    { key: 'message', type: COLUMN_TYPES.STRING(500) },
    { key: 'groupID', type: COLUMN_TYPES.NUMBER },
    { key: 'active', type: COLUMN_TYPES.BOOLEAN },
    { key: 'textColor', type: COLUMN_TYPES.STRING(10) },
    { key: 'backgroundColor', type: COLUMN_TYPES.STRING(10) },
    { key: 'fontWeight', type: COLUMN_TYPES.STRING(30) },
    { key: 'displayOrder', type: COLUMN_TYPES.NUMBER },
    { key: 'isPriority', type: COLUMN_TYPES.BOOLEAN }
  ]
};
const logoImageTableInfo = {
  tableName: 'LOGO_IMAGES',
  createStatement: 'CREATE TABLE IF NOT EXISTS LOGO_IMAGES(logoImageID int NOT NULL AUTO_INCREMENT, imageID int, title varchar(255), displayOrder int, imageType int, imageVersion int, PRIMARY KEY (logoImageID), FOREIGN KEY(imageID) REFERENCES IMAGES(imageID) ON DELETE CASCADE)',
  pk: 'logoImageID',
  columns: [
    { key: 'logoImageID', type: COLUMN_TYPES.NUMBER },
    { key: 'imageID', type: COLUMN_TYPES.NUMBER },
    { key: 'title', type: COLUMN_TYPES.STRING(255) },
    { key: 'displayOrder', type: COLUMN_TYPES.NUMBER },
    { key: 'imageType', type: COLUMN_TYPES.NUMBER },
  ]
};
const imageTableInfo = {
  tableName: 'IMAGES',
  createStatement: 'CREATE TABLE IF NOT EXISTS IMAGES(imageID int NOT NULL AUTO_INCREMENT, imageSuffix varchar(20), version int, PRIMARY KEY (imageID))',
  pk: 'imageID',
  columns: [
    { key: 'imageID', type: COLUMN_TYPES.NUMBER },
    { key: 'imageSuffix', type: COLUMN_TYPES.STRING(20) },
    { key: 'version', type: COLUMN_TYPES.NUMBER }
  ]
};
//Action: Enable, Disable, Toggle
//Type: Time, State
//Info
//
const restrictionConditionTableInfo = {
  tableName: 'RESTRICTION_CONDITIONS',
  createStatement: 'CREATE TABLE IF NOT EXISTS RESTRICTION_CONDITIONS(conditionID int NOT NULL AUTO_INCREMENT, restrictionID int, conditionAction int, conditionType int, conditionInfo varchar(2000), PRIMARY KEY(conditionID), FOREIGN KEY(restrictionID) REFERENCES RESTRICTIONS(restrictionID) ON DELETE CASCADE)',
  pk: 'conditionID',
  columns: [
    { key: 'conditionID', type: COLUMN_TYPES.NUMBER },
    { key: 'restrictionID', type: COLUMN_TYPES.NUMBER },
    { key: 'conditionAction', type: COLUMN_TYPES.NUMBER_NULL },
    { key: 'conditionType', type: COLUMN_TYPES.NUMBER_NULL },
    { key: 'conditionInfo', type: COLUMN_TYPES.STRING_NULL(2000) }
  ]
};
const singletonDataTableInfo = {
  tableName: 'SINGLETON_DATA',
  createStatement: 'CREATE TABLE IF NOT EXISTS SINGLETON_DATA(data_key VARCHAR(40) NOT NULL, value VARCHAR(100), PRIMARY KEY(data_key))',
  pk: 'data_key',
  columns: [
    { key: "data_key", type: COLUMN_TYPES.STRING(40) },
    { key: "value", type: COLUMN_TYPES.STRING_NULL(100) }
  ]
};

module.exports = {userTableInfo, restrictionGroupTableInfo, restrictionTableInfo, logoImageTableInfo, imageTableInfo, restrictionConditionTableInfo, singletonDataTableInfo}
