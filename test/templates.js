'use strict';

let assert = require('assert');
let _ = require('lodash');
let formioUtils = require('formio-utils');

module.exports = (app, template, hook) => {
  describe('Template Imports', function() {
    /**
     * Util function to get the resource name, given an id.
     *
     * @param project
     * @param id
     * @returns {*}
     */
    let getResourceFromId = (project, id) => {
      project = project || {};
      project.forms = project.forms || {};
      project.resources = project.resources || {};

      let resourceName;
      if (project.forms[id]) {
        resourceName = project.forms[id].machineName;
      }
      else if (project.resources[id]) {
        resourceName = project.resources[id].machineName;
      }
      else if (project.roles[id]) {
        resourceName = project.roles[id].machineName
      }

      return resourceName;
    };

    /**
     * Util function to compare the input template with the current resources in mongo.
     *
     * @param project
     * @param input
     * @param done
     */
    let checkTemplateRoles = (project, input, done) => {
      input = input || {};

      app.formio.resources.role.model.find({deleted: {$eq: null}}).then(roles => {
        assert.equal(roles.length, Object.keys(input).length);

        // If the input is empty, skip remaining checks.
        if (Object.keys(input).length === 0) {
          return done();
        }

        // Check that the template data doesnt contain any _id's or machineNames
        Object.keys(input).forEach(machineName => {
          let role = input[machineName];

          assert.equal(role.hasOwnProperty('_id'), false);
          assert.equal(role.hasOwnProperty('machineName'), false);
        });

        let given = {};

        // Memoize the roles.
        project.roles = {};
        roles.forEach(role => {
          role = role.toObject();

          // Check that each role in mongo has an _id and a machineName.
          assert.equal(role.hasOwnProperty('_id'), true);
          assert.equal(role.hasOwnProperty('machineName'), true);

          // Prepare the stored roles for comparison.
          let machineName = role.machineName;
          given[machineName] = _.omit(role, ['_id', '__v', 'created', 'deleted', 'modified', 'machineName']);

          project.roles[machineName] = project.roles[role._id] = role;
        });

        assert.deepEqual(given, input);
        done();
      })
      .catch(done);
    };

    /**
     * Util function to compare the input template with the current resources in mongo.
     *
     * @param project
     * @param type
     * @param input
     * @param done
     */
    let checkTemplateFormsAndResources = (project, type, input, done) => {
      input = input || {};

      app.formio.resources.form.model.find({type, deleted: {$eq: null}}).then(forms => {
        assert.equal(forms.length, Object.keys(input).length);

        if (Object.keys(input).length === 0) {
          return done()
        }

        // Check that the template data doesnt contain any _id's or machineNames
        Object.keys(input).forEach(machineName => {
          let form = input[machineName];

          assert.equal(form.hasOwnProperty('_id'), false);
          assert.equal(form.hasOwnProperty('machineName'), false);
        });

        let given = {};

        // Memoize the forms.
        project[`${type}s`] = {};
        forms.forEach(form => {
          form = form.toObject();

          // Check that each form in mongo has an _id and machineName.
          assert.equal(form.hasOwnProperty('_id'), true);
          assert.equal(form.hasOwnProperty('machineName'), true);

          let machineName = form.machineName;
          let tempForm = _.omit(form, ['_id', '__v', 'created', 'deleted', 'modified', 'machineName', 'owner']);

          tempForm.access = tempForm.access.map(access => {
            access.roles = access.roles.map(role => {
              return project.roles[role.toString()].machineName;
            });

            return access;
          });

          tempForm.submissionAccess = tempForm.submissionAccess.map(access => {
            access.roles = access.roles.map(role => {
              return project.roles[role.toString()].machineName;
            });

            return access;
          });
          given[machineName] = tempForm;

          project[`${type}s`][form.machineName] = project[`${type}s`][form._id] = form;
        });

        // Reassign the resources after the forms have been memoized.
        Object.keys(given).forEach(machineName => {
          let tempForm = given[machineName];
          // Convert all resources to point to the resource name;
          formioUtils.eachComponent(tempForm.components, (component) => {
            if (component.hasOwnProperty('resource') && project.resources && project.resources.hasOwnProperty(component.resource)) {
              component.resource = project.resources[component.resource].name;
            }
          }, true);
          given[machineName] = tempForm;
        });

        assert.deepEqual(given, input);
        done();
      })
      .catch(done);
    };

    /**
     * Util function to compare the input template with the current resources in mongo.
     *
     * @param project
     * @param input
     * @param done
     */
    let checkTemplateActions = (project, input, done) => {
      input = input || {};

      app.formio.actions.model.find({deleted: {$eq: null}}).then(actions => {
        assert.equal(actions.length, Object.keys(input).length);

        if (Object.keys(input).length === 0) {
          return done()
        }

        // Check that the template data doesnt contain any _id's or machineNames
        Object.keys(input).forEach(machineName => {
          let action = input[machineName];

          assert.equal(action.hasOwnProperty('_id'), false);
          assert.equal(action.hasOwnProperty('machineName'), false);
        });

        let given = {};

        // Memoize the forms.
        project.actions = {};
        actions.forEach(action => {
          action = action.toObject();

          // Check that each action in mongo has an _id and machineName.
          assert.equal(action.hasOwnProperty('_id'), true);
          assert.equal(action.hasOwnProperty('machineName'), true);

          // Prepare the stored actions for comparison.
          let machineName = action.machineName;
          let tempAction = _.omit(action, ['_id', '__v', 'created', 'deleted', 'modified', 'machineName']);
          tempAction.form = getResourceFromId(project, tempAction.form);
          if (_.has(tempAction, 'settings.resource')) {
            tempAction.settings.resource = getResourceFromId(project, tempAction.settings.resource);
          }
          if (_.has(tempAction, 'settings.resources')) {
            tempAction.settings.resources = tempAction.settings.resources.map(resource => {
              return getResourceFromId(project, resource);
            });
          }
          if (_.has(tempAction, 'settings.role')) {
            tempAction.settings.role = project.roles[tempAction.settings.role].machineName;
          }
          given[machineName] = tempAction;

          project.actions[machineName] = project.actions[action._id] = action;
        });

        assert.deepEqual(given, input);
        done();
      })
      .catch(done);
    };

    describe('Empty Template', function() {
      let testTemplate = require('../src/templates/empty.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the empty template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('No forms should exist', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('No resources should exist', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('No actions should exist', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};
        
        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }
            
            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The empty template should export all its roles', function(done) {
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The empty template should not export any forms', function(done) {
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The empty template should not export any resources', function(done) {
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The empty template should not export any actions', function(done) {
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version']), _.omit(testTemplate, ['plan', 'version']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('Default Template', function() {
      let testTemplate = require('../src/templates/default.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('All the actions should be imported', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should export all its roles', function(done) {
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should export all of its forms', function(done) {
          assert.notDeepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should not export any resources', function(done) {
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version']), _.omit(testTemplate, ['plan', 'version']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('cyclicalResources Template', function() {
      let testTemplate = require('./fixtures/templates/cyclicalResources.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('All the actions should be imported', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should not export any roles', function(done) {
          assert.deepEqual(exportData.roles, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should not export any forms', function(done) {
          assert.deepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should export all of its resources', function(done) {
          assert.notDeepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version']), _.omit(testTemplate, ['plan', 'version']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('waterfallResources Template', function() {
      let testTemplate = require('./fixtures/templates/waterfallResources.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('All the actions should be imported', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should not export any roles', function(done) {
          assert.deepEqual(exportData.roles, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should not export any forms', function(done) {
          assert.deepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should export all of its resources', function(done) {
          assert.notDeepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version']), _.omit(testTemplate, ['plan', 'version']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('waterfallResourcesReverse Template', function() {
      let testTemplate = require('./fixtures/templates/waterfallResourcesReverse.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('All the actions should be imported', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should not export any roles', function(done) {
          assert.deepEqual(exportData.roles, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should not export any forms', function(done) {
          assert.deepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should export all of its resources', function(done) {
          assert.notDeepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version']), _.omit(testTemplate, ['plan', 'version']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('unknownResources Template', function() {
      let testTemplate = require('./fixtures/templates/unknownResources.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('All the actions should be imported', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should not export any roles', function(done) {
          assert.deepEqual(exportData.roles, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should not export any forms', function(done) {
          assert.deepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should export all of its resources', function(done) {
          assert.notDeepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version']), _.omit(testTemplate, ['plan', 'version']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('unknownFormResources Template', function() {
      let testTemplate = require('./fixtures/templates/unknownFormResources.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('All the actions should be imported', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should not export any roles', function(done) {
          assert.deepEqual(exportData.roles, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should export all of its forms', function(done) {
          assert.notDeepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should not export any resources', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version']), _.omit(testTemplate, ['plan', 'version']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('waterfallFormResources Template', function() {
      let testTemplate = require('./fixtures/templates/waterfallFormResources.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('All the actions should be imported', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should not export any roles', function(done) {
          assert.deepEqual(exportData.roles, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should not export any forms', function(done) {
          assert.notDeepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should not export any resources', function(done) {
          assert.notDeepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version']), _.omit(testTemplate, ['plan', 'version']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('waterfallFormResourcesReverse Template', function() {
      let testTemplate = require('./fixtures/templates/waterfallFormResourcesReverse.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('All the actions should be imported', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should not export any roles', function(done) {
          assert.deepEqual(exportData.roles, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should export all of its forms', function(done) {
          assert.notDeepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should export all of its resources', function(done) {
          assert.notDeepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version']), _.omit(testTemplate, ['plan', 'version']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('emptyResources Template', function() {
      let testTemplate = require('./fixtures/templates/emptyResources.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('All the actions should be imported', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should not export any roles', function(done) {
          assert.deepEqual(exportData.roles, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should export all of its forms', function(done) {
          assert.notDeepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should not export any resources', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version']), _.omit(testTemplate, ['plan', 'version']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('selfReferencingResources Template', function() {
      let testTemplate = require('./fixtures/templates/selfReferencingResources.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('All the actions should be imported', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should not export any roles', function(done) {
          assert.deepEqual(exportData.roles, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should not export any forms', function(done) {
          assert.deepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should export all of its resources', function(done) {
          assert.notDeepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version']), _.omit(testTemplate, ['plan', 'version']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('unknownActionResources Template', function() {
      let testTemplate = require('./fixtures/templates/unknownActionResources.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('Actions with invalid forms and resources should not be imported', function(done) {
          checkTemplateActions(project, {}, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should not export any roles', function(done) {
          assert.deepEqual(exportData.roles, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should not export any forms', function(done) {
          assert.deepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should not export any resources', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any malformed actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.equal(exportData.version, '2.0.0');

          // Update the test template to not contain any of the malformed actions.
          testTemplate.actions = {};

          assert.deepEqual(_.omit(exportData, ['plan', 'version']), _.omit(testTemplate, ['plan', 'version']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('emptyActionResources Template', function() {
      let testTemplate = require('./fixtures/templates/emptyActionResources.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('Actions with invalid forms and resources should not be imported', function(done) {
          checkTemplateActions(project, {}, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should export all its roles', function(done) {
          assert.deepEqual(exportData.roles, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should not export any forms', function(done) {
          assert.deepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should not export any resources', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any malformed actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.equal(exportData.version, '2.0.0');

          // Update the test template to not contain any of the malformed actions.
          testTemplate.actions = {};

          assert.deepEqual(_.omit(exportData, ['plan', 'version']), _.omit(testTemplate, ['plan', 'version']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('unknownRoleResources Template', function() {
      let testTemplate = require('./fixtures/templates/unknownRoleResources.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported with the defined roles only', function(done) {
          testTemplate.forms.foo.access[0].roles = [];
          testTemplate.forms.foo.submissionAccess[0].roles = [];

          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('All the actions should be imported', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should export all its roles', function(done) {
          assert.notDeepEqual(exportData.roles, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should export its forms without bad roles', function(done) {
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should not export any resources', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version']), _.omit(testTemplate, ['plan', 'version']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('missingRoleResources Template', function() {
      let testTemplate = require('./fixtures/templates/missingRoleResources.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('No roles should be imported', function(done) {
          assert.deepEqual(testTemplate.roles, undefined);
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('All the actions should be imported', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should export an empty list of roles', function(done) {
          assert.deepEqual(exportData.roles, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should not export any forms', function(done) {
          assert.deepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should not export any resources', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.deepEqual(exportData.roles, {});
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version', 'roles']), _.omit(testTemplate, ['plan', 'version', 'roles']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('missingResourceResources Template', function() {
      let testTemplate = require('./fixtures/templates/missingResourceResources.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('No resources should be imported', function(done) {
          assert.deepEqual(testTemplate.resources, undefined);
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('All the actions should be imported', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should not export any roles', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should not export any forms', function(done) {
          assert.deepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should not export any resources', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.deepEqual(exportData.resources, {});
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version', 'resources']), _.omit(testTemplate, ['plan', 'version', 'resources']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('missingFormResources Template', function() {
      let testTemplate = require('./fixtures/templates/missingFormResources.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('No forms should be imported', function(done) {
          assert.deepEqual(testTemplate.forms, undefined);
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('All the actions should be imported', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should not export any roles', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should not export any forms', function(done) {
          assert.deepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should not export any resources', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.deepEqual(exportData.forms, {});
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version', 'forms']), _.omit(testTemplate, ['plan', 'version', 'forms']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('missingActionResources Template', function() {
      let testTemplate = require('./fixtures/templates/missingActionResources.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('No actions should be imported', function(done) {
          assert.deepEqual(testTemplate.actions, undefined);
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should not export any roles', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should not export any forms', function(done) {
          assert.deepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should not export any resources', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.deepEqual(exportData.actions, {});
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version', 'actions']), _.omit(testTemplate, ['plan', 'version', 'actions']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('missingTitle Template', function() {
      let testTemplate = require('./fixtures/templates/missingTitle.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('All the actions should be imported', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should not export any roles', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should not export any forms', function(done) {
          assert.deepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should not export any resources', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.deepEqual(exportData.title, 'Export');
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version', 'title']), _.omit(testTemplate, ['plan', 'version', 'title']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('missingName Template', function() {
      let testTemplate = require('./fixtures/templates/missingName.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('All the actions should be imported', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should not export any roles', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should not export any forms', function(done) {
          assert.deepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should not export any resources', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version', 'name']), _.omit(testTemplate, ['plan', 'version', 'name']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });

    describe('missingDescription Template', function() {
      let testTemplate = require('./fixtures/templates/missingDescription.json');
      let _template = _.cloneDeep(testTemplate);

      describe('Import', function() {
        let project = {};

        it('Should be able to bootstrap the template', function(done) {
          app.formio.template.import(_template, (err) => {
            if (err) {
              return done(err);
            }

            done();
          });
        });

        it('All the roles should be imported', function(done) {
          checkTemplateRoles(project, testTemplate.roles, done);
        });

        it('All the forms should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
        });

        it('All the resources should be imported', function(done) {
          checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
        });

        it('All the actions should be imported', function(done) {
          checkTemplateActions(project, testTemplate.actions, done);
        });
      });

      describe('Export', function() {
        let project = {};
        let exportData = {};

        it('Should be able to export project data', function(done) {
          app.formio.template.export(testTemplate, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;
            return done();
          });
        });

        it('An export should contain the export title', function() {
          assert.equal(
            hook.alter('exportTitle', 'Export', exportData),
            'Export'
          );
        });

        it('An export should contain the current export version', function() {
          assert.equal(
            exportData.version,
            '2.0.0'
          );
        });

        it('An export should contain the description', function() {
          assert.equal(
            hook.alter('exportDescription', '', exportData),
            ''
          );
        });

        it('An export should contain the export name', function() {
          assert.equal(
            hook.alter('exportName', 'export', exportData),
            'export'
          );
        });

        it('An export should contain the export plan', function() {
          assert.equal(
            hook.alter('exportPlan', 'community', exportData),
            'community'
          );
        });

        it('The template should not export any roles', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateRoles(project, exportData.roles, done);
        });

        it('The template should not export any forms', function(done) {
          assert.deepEqual(exportData.forms, {});
          checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
        });

        it('The template should not export any resources', function(done) {
          assert.deepEqual(exportData.resources, {});
          checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
        });

        it('The template should not export any actions', function(done) {
          assert.deepEqual(exportData.actions, {});
          checkTemplateActions(project, exportData.actions, done);
        });

        it('An export should match an import', function() {
          assert.equal(exportData.version, '2.0.0');
          assert.deepEqual(_.omit(exportData, ['plan', 'version', 'description']), _.omit(testTemplate, ['plan', 'version', 'description']));
        });
      });

      before(function(done) {
        template.clearData(done);
      });

      after(function(done) {
        template.clearData(done);
      });
    });
  });
};
