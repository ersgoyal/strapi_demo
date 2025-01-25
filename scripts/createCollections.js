const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const apiFolder = path.join(__dirname, '../src/api');
const dataFolder = path.join(__dirname, '../data');

function createFolders(collectionName) {
  const collectionPath = path.join(apiFolder, collectionName);
  const folders = ['controllers', 'services', 'routes', 'content-types'];

  folders.forEach((folder) => {
    const folderPath = path.join(collectionPath, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
  });

  // Return path to the content-types folder for schema.json
  const contentTypeFolderPath = path.join(collectionPath, 'content-types', collectionName);
  if (!fs.existsSync(contentTypeFolderPath)) {
    fs.mkdirSync(contentTypeFolderPath, { recursive: true });
  }

  return contentTypeFolderPath;
}

function generateSchema(collectionName, attributes) {
  return {
    info: {
      singularName: collectionName,
      pluralName: `${collectionName}s`,
      displayName: collectionName.charAt(0).toUpperCase() + collectionName.slice(1),
    },
    options: {
      draftAndPublish: true,
    },
    attributes,
    kind: 'collectionType',
  };
}

function writeFiles(collectionName, schema) {
  const contentTypePath = createFolders(collectionName);

  // Write or update schema.json
  const schemaPath = path.join(contentTypePath, 'schema.json');
  if (fs.existsSync(schemaPath)) {
    const existingSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    if (JSON.stringify(existingSchema) !== JSON.stringify(schema)) {
      fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
      console.log(`Schema for '${collectionName}' updated.`);
    } else {
      console.log(`Schema for '${collectionName}' is already up to date. No changes made.`);
    }
  } else {
    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
    console.log(`Schema for '${collectionName}' created.`);
  }

  // Write default controller
  const controllerPath = path.join(apiFolder, collectionName, 'controllers', `${collectionName}.js`);
  if (!fs.existsSync(controllerPath)) {
    fs.writeFileSync(
      controllerPath,
      `'use strict';

      const { createCoreController } = require('@strapi/strapi').factories;

      module.exports = createCoreController('api::${collectionName}.${collectionName}');`
    );
  }

  // Write default service
  const servicePath = path.join(apiFolder, collectionName, 'services', `${collectionName}.js`);
  if (!fs.existsSync(servicePath)) {
    fs.writeFileSync(
      servicePath,
      `'use strict';

      const { createCoreService } = require('@strapi/strapi').factories;

      module.exports = createCoreService('api::${collectionName}.${collectionName}');`
    );
  }

  // Write default routes
  const routesPath = path.join(apiFolder, collectionName, 'routes', `${collectionName}.js`);
  if (!fs.existsSync(routesPath)) {
    fs.writeFileSync(
      routesPath,
      `'use strict';

      const { createCoreRouter } = require('@strapi/strapi').factories;

      module.exports = createCoreRouter('api::${collectionName}.${collectionName}');`
    );
  }
}

function readCSVAndCreateCollection(filePath) {
  const attributes = {};
  const collectionName = path.basename(filePath, '.csv');

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      const attribute = {
        type: row.type,
        required: row.required === 'true',
        unique: row.unique === 'true',
      };

      if (row.type === 'relation') {
        attribute.relation = 'manyToOne'; // Default relation type
        attribute.target = 'plugin::users-permissions.user'; // Adjust as needed
      }

      attributes[row.fieldName] = attribute;
    })
    .on('end', () => {
      const schema = generateSchema(collectionName, attributes);
      writeFiles(collectionName, schema);
    });
}

// Run the script
fs.readdir(dataFolder, (err, files) => {
  if (err) {
    console.error('Error reading data folder:', err);
    return;
  }

  const csvFiles = files.filter(file => file.endsWith('.csv'));

  if (csvFiles.length === 0) {
    console.log('No CSV files found in the data folder.');
    return;
  }

  csvFiles.forEach(file => {
    const filePath = path.join(dataFolder, file);
    readCSVAndCreateCollection(filePath);
  });
});
