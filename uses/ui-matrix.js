/* toxmatrix.js - Read-across UI tool
 *
 * Copyright 2012-2014, IDEAconsult Ltd. http://www.ideaconsult.net/
 * Created by Ivan Georgiev
**/

var jTConfig = {};

function jTConfigurator(kit) {
  return jTConfig.matrix;
}

var jToxBundle = {
  createForm: null,
  rootElement: null,
  bundleUri: null,
  bundleSummary: {
    compound: 0,
    substance: 0,
    property: 0,
    matrix: 0,
  },

  edit: {
    study: [],
  },

  settings: {
    studyTypeList: _i5.qaSettings["Study result type"],
    maxStars: 10,
    matrixIdentifiers: [
      "http://www.opentox.org/api/1.1#CASRN",
      "#SubstanceName",
      "#SubstanceUUID",
      "http://www.opentox.org/api/1.1#SubstanceDataSource",
    ],
    matrixMultiRows: [
      "#Tag",
      "http://www.opentox.org/api/1.1#Diagram",
      "#ConstituentName",
      "#ConstituentContent",
      "#ConstituentContainedAs"
    ]
  },

  parseFeatureId: function (featureId) {
    var parse = featureId.match(/https?\:\/\/(.*)\/property\/([^\/]+)\/([^\/]+)\/.+/);
    if (parse == null)
      return null;
    else
      return {
        topcategory: parse[2].replace("+", " "),
        category: parse[3].replace("+", " ")
      };
  },

  init: function (root, settings) {
    var self = this;

    self.rootElement = root;
    self.settings = $.extend(self.settings, jT.settings, settings);

    // deal with some configuration
    if (typeof self.settings.studyTypeList == 'string')
      self.settings.studyTypeList = window[self.settings.studyTypeList];

    // the (sub)action in the panel
    var loadAction = function () {
      if (!this.checked)
        return;
      document.body.className = this.id;
      var method = $(this).parent().data('action');
      if (!method)
        return;
      ccLib.fireCallback(self[method], self, this.id, $(this).closest('.ui-tabs-panel')[0], false);
    };

    var loadPanel = function(panel) {
      if (panel){
        var subs = $('.jq-buttonset.action input:checked', panel);
        if (subs.length > 0)
          subs.each(loadAction);
        else
          ccLib.fireCallback(self[$(panel).data('action')], self, panel.id, panel, true);
      }
    };

    // initialize the tab structure for several versions of dataTables.
    $(root).tabs({
      "disabled": [1, 2, 3, 4],
      "heightStyle": "fill",
      "select" : function(event, ui) {
        loadPanel(ui.panel);
      },
      "activate" : function(event, ui) {
        if (ui.newPanel)
          loadPanel(ui.newPanel[0]);
      },
      "create" : function(event, ui) {
        if (ui.panel)
          loadPanel(ui.panel[0]);
      }
    });

    $('.jq-buttonset', root).buttonset();
    $('.jq-buttonset.action input', root).on('change', loadAction);

    var updateUsers = function(){
      var el = this.select; // here this refers to the tokenizer
      $(el.parentNode).addClass('loading');
      var property = (el[0].id == 'users-write') ? 'canWrite' : 'canRead';
      var data = 'bundle_number=' + self.bundle.number;
      var users = el.val();
      if(users) {
        for(var i = 0, l = users.length; i < l; i++){
          data += '&' + property + '=' + users[i];
        }
      }
      jT.service(self, self.settings.baseUrl + '/myaccount/users', { method: 'POST', data: data }, function(result){
        $(el.parentNode).removeClass('loading');
        if (!result) { // i.e. on error - request the old data
          //self.loadUsers(); // this causes infinite loop because it triggers onRemoveToken callback.
        }
      });
    }

    $('.jtox-users-select', root).tokenize({
      datas: self.settings.baseUrl + '/myaccount/users',
      searchParam: 'q',
      valueField: 'id',
      textField: 'name',
      onAddToken: updateUsers,
      onRemoveToken: updateUsers
    });

    self.onIdentifiers(null, $('#jtox-identifiers', self.rootElement)[0]);
    // finally, if provided - load the given bundleUri
    var bUri = self.settings.bundleUri || self.settings.bundle_uri;
    if (!!bUri)
      self.load(bUri);

    return self;
  },

  starHighlight: function (root, stars) {
    $('span', root).each(function (idx) {
      if (idx < stars)
        $(this).removeClass('transparent');
      else
        $(this).addClass('transparent');
    });
  },

  modifyUri: function (uri) {
    return ccLib.addParameter(uri, "bundle_uri=" + encodeURIComponent(this.bundleUri));
  },

  onIdentifiers: function (id, panel) {
    var self = this;
    if (!$(panel).hasClass('initialized')) {
      $(panel).addClass('initialized');
      var checkForm = function () {
        this.placeholder = "You need to fill this box";
        return this.value.length > 0;
      };

      self.createForm = $('form', panel)[0];
      // TODO: assign this on form submit, not on button click.
      //       Forms can be submitted in a number of other ways.
      self.createForm.assStart.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (ccLib.validateForm(self.createForm, checkForm)) {
          jT.service(self, '/bundle', { method: 'POST', data: ccLib.serializeForm(self.createForm)}, function (bundleUri, jhr) {
            if (!!bundleUri)
              self.load(bundleUri);
            else
              // TODO: report an error
              console.log("Error on creating bundle [" + jhr.status + ": " + jhr.statusText);
          });
        }
      };

      self.createForm.assNewVersion.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!self.bundleUri)
          return;
        jT.service(self, self.bundleUri + '/version', { method: 'POST' }, function (bundleUri, jhr) {
          if (!!bundleUri)
            self.load(bundleUri);
          else
            // TODO: report an error
            console.log("Error on creating bundle [" + jhr.status + ": " + jhr.statusText);
        });
      };

      self.createForm.assFinalize.style.display = 'none';
      self.createForm.assNewVersion.style.display = 'none';

      var starsEl = $('.data-stars-field', self.createForm)[0];
      starsEl.innerHTML += jT.ui.putStars(self, 0, "Assessment rating");
      $('span.ui-icon-star', starsEl)
      .on('mouseover', function (e) {
        for (var el = this; !!el; el = el.previousElementSibling)
          $(el).removeClass('transparent');
        for (var el = this.nextElementSibling; !!el; el = el.nextElementSibling)
          $(el).addClass('transparent');
      })
      .on('click', function (e) {
        var cnt = 0;
        for (var el = this; !!el; el = el.previousElementSibling, ++cnt);
        self.createForm.stars.value = cnt;
        $(self.createForm.stars).trigger('change');
      })
      .parent().on('mouseout', function (e) {
        self.starHighlight(this, parseInt(self.createForm.stars.value));
      });

      // install change handlers so that we can update the values
      $('input, select, textarea', self.createForm).on('change', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!self.bundleUri)
          return;
        var el = this;
        if (ccLib.fireCallback(checkForm, el, e)) {
          var data = {};
          data[el.name] = el.value;
          $(el).addClass('loading');
          jT.service(self, self.bundleUri, { method: 'PUT', data: data } , function (result) {
            $(el).removeClass('loading');
            if (!result) { // i.e. on error - request the old data
              self.load(self.bundleUri);
            }
          });
        }
      });

      ccLib.prepareForm(self.createForm);
    }
  },

  // called when a sub-action in bundle details tab is called
  onMatrix: function (panId, panel) {
    var self = this;
    if (!$(panel).hasClass('initialized')) {
      jTConfig.matrix.groups = function (miniset, kit) {
        var groups = { "Identifiers" : self.settings.matrixIdentifiers.concat(self.settings.matrixMultiRows) },
            groupids = [],
            endpoints = {};

        var fRender = function (feat, theId) {
          return function (data, type, full) {
            if (type != 'display')
              return '-';

            var html = '';
            for (var fId in self.matrixKit.dataset.feature) {
              var f = self.matrixKit.dataset.feature[fId];
              if (f.sameAs != feat.sameAs || full.values[fId] == null)
                continue;

              var catId = self.parseFeatureId(fId).category,
                  config = jT.$.extend(true, {}, kit.settings.configuration.columns["_"], kit.settings.configuration.columns[catId]);

              var theData = full.values[fId];
              var preVal = (ccLib.getJsonValue(config, 'effects.endpoint.bVisible') !== false) ? "<strong>"+f.title+"</strong>" : null;

              var icon = f.isModelPredictionFeature?"ui-icon-calculator":"ui-icon-tag";
              var studyType = "<span class='ui-icon "+icon+"' title='" + f.source.type + "'></span>";
              //preVal = [preVal, f.source.type].filter(function(value){return value!==null}).join(' : ');

              var postVal = '', postValParts = [], parameters = [], conditions = [];
              for (var i = 0, l = f.annotation.length; i < l; i++){
                var a = f.annotation[i];
                if ( a.type == 'conditions' && ccLib.getJsonValue(config, 'conditions.' + a.p.toLowerCase() + '.inMatrix') == true ) {
                  conditions.push(a.p + ' = ' + a.o);
                }
                else if (a.type == 'parameters') {
                  parameters.push(a.o);
                }
              }
              if(parameters.length > 0){
                postValParts.push('<span>' + parameters.join(', ') + '</span>');
              }
              if(conditions.length > 0){
                postValParts.push('<span>' + conditions.join(', ') + '</span>');
              }
              if(f.creator !== undefined && f.creator != null && f.creator != '' && f.creator != 'null' && f.creator != 'no data'){
                postValParts.push('<span class="shortened" title="'+f.creator+'">'+f.creator + '</span>');
              }
              postVal = '(' + postValParts.join(', ') + ')';

              if (!f.isMultiValue || !$.isArray(theData)){
                theData = [theData];
              }

              // now - ready to produce HTML
              for (var i = 0, vl = theData.length; i < vl; ++i) {
                var d = theData[i];
                if (d.deleted && !self.edit.matrixEditable)
                  continue;
                html += '<div>';
                if (self.edit.matrixEditable) {
                  if (d.deleted){
                    html += '<span class="ui-icon ui-icon-info delete-popup"></span>&nbsp;';
                  }
                  else {
                    html += '<span class="ui-icon ui-icon-circle-minus delete-popup"></span>&nbsp;';
                  }
                }
                html += '<a class="info-popup' + ((d.deleted) ? ' deleted' : '') + '" data-index="' + i + '" data-feature="' + fId + '" href="#">' + jT.ui.renderObjValue(d, f.units, 'display', preVal) + '</a>'
                     + studyType
                     + ' ' + postVal;
                html += jT.ui.putInfo(full.compound.URI + '/study?property_uri=' + encodeURIComponent(fId));
                html += '</div>';
              }
            }

            if (self.edit.matrixEditable)
              html += '<span class="ui-icon ui-icon-circle-plus edit-popup" data-feature="' + theId + '"></span>';
            return  html;
          };
        };

        for (var fId in miniset.feature) {
          var feat = miniset.feature[fId];
          if (feat.sameAs == null || feat.sameAs.indexOf("echaEndpoints.owl#") < 0)
            continue;

          var catId = self.parseFeatureId(fId).topcategory;
          var grp = groups[catId];
          if (grp == null)
            groups[catId] = grp = [];

          if (endpoints[feat.sameAs] == null) {
            endpoints[feat.sameAs] = true;
            if (!feat.title)
              feat.title = feat.sameAs.substr(feat.sameAs.indexOf('#') + 1);
            feat.render = fRender(feat, fId);
            feat.column = { sClass: "breakable", sWidth: "80px" };
            grp.push(fId);
          }
        }

        /*
         * Sort columns alphabetically, in this case - by the category number.
         */
        for(var grp in groups) {
          if(grp != 'Identifiers'){
            var group = groups[grp];
            group.sort(function(a,b){
              if (miniset.feature[a].title == miniset.feature[b].title) {
                return 0;
              }
              return (miniset.feature[a].title < miniset.feature[b].title) ? -1 : 1;
            });
          }
        }

        /*
         * Sort groups by the columns titles / category number.
         * Since we are trying to sort an Object keys, which is
         * itself nonsense in JavaScript, this may fail at any time.
         */
        groupids = Object.keys(groups);

        groupids.sort(function(a, b){
          if (a == 'Identifiers') return -1;
          if (b == 'Identifiers') return 1;
          a = groups[a][0], b = groups[b][0];
          if (miniset.feature[a].title == miniset.feature[b].title) {
            return 0;
          }
          return (miniset.feature[a].title < miniset.feature[b].title) ? -1 : 1;
        })

        var newgroups = {};

        groupids.forEach(function(i, v){
          newgroups[i] = groups[i];
        });

        groups = newgroups;

        return groups;
      }

      $(panel).addClass('initialized');

      var conf = $.extend(true, {}, jTConfig.matrix, config_study);

      conf.baseFeatures['#IdRow'] = { used: true, basic: true, data: "number", column: { "sClass": "center"}, render: function (data, type, full) {
        if (type != 'display')
          return data || 0;
        var html = "&nbsp;-&nbsp;" + data + "&nbsp;-&nbsp;<br/>";
        html += '<button type="button" class="ui-button ui-button-icon-only jtox-up"><span class="ui-icon ui-icon-triangle-1-n">up</span></button><br />' +
                '<button type="button" class="ui-button ui-button-icon-only jtox-down"><span class="ui-icon ui-icon-triangle-1-s">down</span></button><br />'
        return html;
      } };

      conf.baseFeatures['#Tag'] = { title: 'Tag', used: false, basic: true, visibility: "main", primary: true, column: { "sClass": "center"}, render: function (data, type, full) {

        if (type != 'display')
          return data || 0;

        var html = "";
        var bInfo = full.component.bundles[self.bundleUri];
        if (!bInfo) {
          return html;
        }
        if (!!bInfo.tag) {
          html += '<button class="jt-toggle active" disabled="true"' + (!bInfo.remarks ? '' : 'title="' + bInfo.remarks + '"') + '>' + (bInfo.tag == 'source' ? 'S' : 'T') + '</button><br />';
        }
        if (!!bInfo.remarks && bInfo.remarks != '') {
          html += jT.ui.putInfo(null, bInfo.remarks);
        }

        return html;
      } };

      conf.baseFeatures['http://www.opentox.org/api/1.1#CASRN'].primary = true;


      var featuresInitialized = false;

      var saveButton = $('.save-button', panel)[0];
      saveButton.disabled = true;
      var dressButton = function() {
        if (self.edit.study.length < 1) {
          saveButton.disabled = true;
          $(saveButton).removeClass('jt-alert').addClass('jt-disabled');
          saveButton.innerHTML = "Saved";
        }
        else {
          saveButton.disabled = false;
          $(saveButton).addClass('jt-alert').removeClass('jt-disabled');
          saveButton.innerHTML = "Save";
        }
      };

      $(saveButton).on('click', function() {
        if (self.edit.study.length > 0) {
          var toAdd = JSON.stringify({ study: self.edit.study });

          // make two nested calls - for adding and for deleting
          $(saveButton).addClass('loading');
          jT.service(self, self.bundleUri + '/matrix', { method: 'PUT', headers: { 'Content-Type': "application/json" }, data: toAdd }, function (result, jhr) {
            if (!!result)
            jT.service(self, self.bundleUri + '/matrix/deleted', { method: 'PUT', headers: { 'Content-Type': "application/json" }, data: toAdd },function (result, jhr) {
              $(saveButton).removeClass('loading');
              if (!!result) {
                self.edit.study = [];
                self.matrixKit.query(self.bundleUri + '/matrix');
                dressButton();
              }
            });
            else
              $(saveButton).removeClass('loading');
          });
        }
      });

      var onEditClick = function (data) {
        var boxOptions = {
          overlay: true,
          closeOnEsc: true,
          closeOnClick: "overlay",
          addClass: "popup-box jtox-toolkit ui-front",
          animation: "zoomIn",
          target: $(this),
          maxWidth: 600,
          zIndex: 90,
          onCloseComplete: function () { this.destroy(); }
        };

        var isDelete = $(this).hasClass('delete-popup');
        var jel = (isDelete ? $('a', this.parentNode) : $(this));

        var featureId = jel.data('feature');
        var valueIdx = jel.data('index');
        var feature = self.matrixKit.dataset.feature[featureId];
        if (!jel.hasClass('edit-popup')) {

          $('.dynamic-condition', infoDiv).remove();
          var dynHead = $('tr.conditions', infoDiv)[0];
          var postCell = $('td.postconditions', infoDiv)[0];

          for (var i = 0, cl = feature.annotation.length; i < cl; ++i) {
            var ano = feature.annotation[i];
            // first add the column
            var el = document.createElement('th');
            el.className = 'dynamic-condition';
            el.innerHTML = ano.p;
            dynHead.appendChild(el);
            // now add the value
            el = document.createElement('td');
            el.className = 'dynamic-condition';
            el.innerHTML = ano.o;
            postCell.parentNode.insertBefore(el, postCell);
          }

          // make sure there is at least one cell.
          if (cl < 1) {
            el = document.createElement('td');
            el.className = 'dynamic-condition';
            el.innerHTML = '-';
            postCell.parentNode.insertBefore(el, postCell);
          }

          $('th.conditions', infoDiv).attr('colspan', cl);

          var val = data.values[featureId];
          if (!feature.isMultiValue || !$.isArray(val))
            val = [val];
          ccLib.fillTree(infoDiv, {
            endpoint: feature.title,
            guidance: feature.creator,
            value: jT.ui.renderObjValue(val[valueIdx], feature.units, 'display'),
//             source: '<a target="_blank" href="' + feature.source.URI + '">' + feature.source.type + '</a>'
          });

          if (isDelete) {
            $('.delete-box', infoDiv).show();
            boxOptions.onOpen = function () {
              var box = this;
              var content = this.content[0];
              if(val[valueIdx].deleted){
                // If the value is already deleted, show remarks
                $('button.jt-alert', content).hide();
                $('textarea', content).val(val[valueIdx].remarks);
              }
              else {
                $('button.jt-alert', content).on('click', function (){ deleteFeature(data, featureId, valueIdx, $('textarea', content).val(), jel[0]); box.close(); });
              }
            };
          }
          else {
            $('.delete-box', infoDiv).hide();
          }

          boxOptions.content = infoDiv.innerHTML;
          new jBox('Tooltip', boxOptions).open();
        }
        else { // edit mode
          var parse = self.parseFeatureId(featureId);
          // map between UI fields and JSON properties
          var valueMap = {
            endpoint: 'effects[0].endpoint',
            value: 'effects[0].result',
            interpretation_result: 'interpretation.result',

            type: 'reliability.r_studyResultType',
            reference: 'citation.title',
            justification: 'protocol.guideline[0]',
            remarks: 'interpretation.criteria'
          };

          // the JSON that is about to be sent on Apply
          var featureJson = {
            owner: {
              substance: {
                uuid: data.compound.i5uuid
              }
            },
            protocol: {
              topcategory: parse.topcategory,
              category: {
                code: parse.category
              },
              endpoint: feature.title,
              guideline: ['']
            },
            citation: {
              year: (new Date()).getFullYear().toString()
            },
            parameters: { },
            interpretation: { },
            reliability: { },
            effects: [{
              result: { },
              conditions: { }
            }]
          };

          // we're taking the original jToxEndpoint editor here and glue our part after it.
          boxOptions.content = jT.getTemplate('#jtox-endeditor').innerHTML + editDiv.innerHTML;
          boxOptions.title = feature.title || parse.category;
          boxOptions.closeButton = "box";
          boxOptions.confirmButton = "Add";
          boxOptions.cancelButton = "Cancel";
          var endSetValue = function (e, field, value) {
            var f = valueMap[field];
            if (!f)
              featureJson.effects[0].conditions[field] = value;
            else
            ccLib.setJsonValue(featureJson, f, value);
          };

          boxOptions.onOpen = function () {
            var box = this;
            var content = this.content[0];
            jToxEndpoint.linkEditors(self.matrixKit, content, { category: parse.category, top: parse.topcategory, onchange: endSetValue, conditions: true });
            $('input[type=button]', content).on('click', function (){ addFeature(data, featureId, featureJson, jel[0]); box.close();});
          };
          new jBox('Modal', boxOptions).open();
        }
      };

      var addFeature = function(data, fId, value, element) {
        self.edit.study.push(value);
        dressButton();

        // now fix the UI a bit, so we can see the
        fId += '/' + self.edit.study.length;

        var catId = self.parseFeatureId(fId).category,
            config = jT.$.extend(true, {}, self.matrixKit.settings.configuration.columns["_"], self.matrixKit.settings.configuration.columns[catId]),
            f = null;

        self.matrixKit.dataset.feature[fId] = f = {};
        f.sameAs = "http://www.opentox.org/echaEndpoints.owl#" + catId;
        f.title = value.effects[0].endpoint || (value.citation.title || "");
        f.creator = value.protocol.guideline[0];
        f.isMultiValue = true;
        f.annotation = [];
        for (var cId in value.effects[0].conditions) {
          f.annotation.push({
            'p': cId,
            'o': jT.ui.renderObjValue(value.effects[0].conditions[cId])
          });
        }

        data.values[fId] = [value.effects[0].result];

        var preVal = (ccLib.getJsonValue(config, 'effects.endpoint.bVisible') !== false) ? f.title : null;
        preVal = [f.creator, preVal].filter(function(value){return value!==null}).join(' ');

        var html =  '<span class="ui-icon ui-icon-circle-minus delete-popup" data-index="' + (self.edit.study.length - 1) + '"></span>&nbsp;';
            html += '<a class="info-popup unsaved-study" data-index="0" data-feature="' + fId + '" href="#">' + jT.ui.renderObjValue(value.effects[0].result, null, 'display', preVal) + '</a>';

        var span = document.createElement('div');
        span.innerHTML = html;
        element.parentNode.insertBefore(span, element);
        self.matrixKit.equalizeTables();

        $('.info-popup', span).on('click', function (e) { onEditClick.call(this, data); });
        $('.delete-popup', span).on('click', function (e) {
          var idx = $(this).data('index');
          self.edit.study.splice(idx, 1);
          $(this.parentNode).remove();
          dressButton();
        });
      };

      var deleteFeature = function (data, featureId, valueIdx, reason, element) {
        self.edit.study.push({
          owner: { substance: { uuid: data.compound.i5uuid } },
          effects_to_delete: [{
            result: {
              idresult: data.values[featureId][valueIdx].idresult,
              deleted: true,
              remarks: reason
            },
          }]
        });
        dressButton();

        // Now deal with the UI
        $(element).addClass('unsaved-study');
        $('span', element.parentNode)
        .removeClass('ui-icon-circle-minus')
        .addClass('ui-icon-circle-plus')
        .data('index', self.edit.study.length - 1)
        .on('click.undodelete', function () {
          var idx = $(this).data('index');
          $(this).addClass('ui-icon-circle-minus').removeClass('ui-icon-circle-plus').off('click.undodelete').data('index', null);
          $('a', this.parentNode).removeClass('unsaved-study');
          self.edit.study.splice(idx, 1);
          dressButton();
        });
      };

      var infoDiv = $('#info-box')[0];
      var editDiv = $('#edit-box')[0];

      // now, fill the select with proper values...
      var df = document.createDocumentFragment();
      for (var id in self.settings.studyTypeList) {
        var opt = document.createElement('option');
        opt.value = id;
        opt.innerHTML = self.settings.studyTypeList[id].title;
        df.appendChild(opt);
      }

      $('select.type-list', editDiv)[0].appendChild(df);

      self.matrixKit = new jToxCompound($('.jtox-toolkit', panel)[0], {
        crossDomain: true,
        rememberChecks: true,
        tabsFolded: true,
        showDiagrams: true,
        showUnits: false,
        hasDetails: false,
        fixedWidth: "650px",
        configuration: conf,
        featureUri: self.bundleUri + '/property',
        onPrepared: function (miniset, kit) {
          if (featuresInitialized)
            return;
          // this is when we have the features combined, so we can make the multi stuff
          var getRender = function (fId, oldData, oldRender) {
            return function (data, type, full) {
              return typeof data != 'object' ? '-' : jT.ui.renderMulti(data, type, full, function (_data, _type, _full){
                var dt = ccLib.getJsonValue(_data, (fId.indexOf('#Diagram') > 0 ? 'component.' : '') + oldData);
                return (typeof oldRender == 'function' ? oldRender(dt, _type, fId.indexOf('#Diagram') > 0 ? _data.component : _data) : dt);
              });
            };
          };

          // and now - process the multi-row columns
          for (var i = 0, mrl = self.settings.matrixMultiRows.length;i < mrl; ++i) {
            var fId = self.settings.matrixMultiRows[i];
            var mr = miniset.feature[fId];
            mr.render = getRender(fId, mr.data, mr.render);
            mr.data = 'composition';
            var col = mr.column;
            if (col == null)
              mr.column = col = { sClass: "jtox-multi" };
            else if (col.sClass == null)
              col.sClass = "jtox-multi";
            else
              col.sClass += " jtox-multi";
          }

          featuresInitialized = true;
        },

        onLoaded: function (dataset) {
          jToxCompound.processFeatures(dataset.feature, this.feature);

          // we need to process
          for (var i = 0, dl = dataset.dataEntry.length; i < dl; ++i) {
            var data = dataset.dataEntry[i];
            if (data.composition != null)
              for (var j = 0;j < data.composition.length; ++j)
                jToxCompound.processEntry(data.composition[j].component, dataset.feature);
          }
        },

        onRow: function (row, data, index) {
          // equalize multi-rows, if there are any
          jT.$('td.jtox-multi .jtox-diagram span.ui-icon', row).on('click', function () {
            setTimeout(function () {
              ccLib.equalizeHeights.apply(window, jT.$('td.jtox-multi table tbody', row).toArray());
            }, 50);
          });

          $('.info-popup, .edit-popup, .delete-popup', row).on('click', function (e) {
            if (!$(this).hasClass('delete-popup') || $(this).data('index') == null)
              onEditClick.call(this, data);
          });

          var self = this;
          $('button.jtox-up', row).on('click', function(){
            var i = $(self.fixTable).find('> tbody > tr').index(row);
            var varRow = $(self.varTable).find('> tbody > tr')[i];
            $(row).insertBefore( $(row.previousElementSibling) );
            $(varRow).insertBefore( $(varRow.previousElementSibling) );
          });
          $('button.jtox-down', row).on('click', function(){
            var i = $(self.fixTable).find('> tbody > tr').index(row);
            var varRow = $(self.varTable).find('> tbody > tr')[i];
            $(row).insertAfter( $(row.nextElementSibling) );
            $(varRow).insertAfter( $(varRow.nextElementSibling) );
          });

        }
      });
    }


    $('.create-button', panel).on('click', function () {
      var el = this;
      $(el).addClass('loading');
      jT.service(self, self.bundleUri + '/matrix/working', { method: 'POST', data: { deletematrix:  false } }, function (result, jhr) {
        $(el).removeClass('loading');
        if (!!result) {
          $('.jtox-toolkit', panel).show();
          $('.save-button', panel).show();
          $('.create-button', panel).hide();
          $('#xfinal').button('enable');
          self.bundleSummary.matrix++;
          self.edit.matrixEditable = true;
          self.matrixKit.query(self.bundleUri + '/matrix/working');
        }
      });
    });

    $('.create-final-button', panel).on('click', function () {
      var el = this;
      $(el).addClass('loading');
      jT.service(self, self.bundleUri + '/matrix/final', { method: 'POST', data: { deletematrix:  false } }, function (result, jhr) {
        $(el).removeClass('loading');
        if (!!result) {
          $('.jtox-toolkit', panel).show();
          $('.save-button', panel).show();
          $('.create-final-button', panel).hide();
          self.bundleSummary['matrix/final']++;
          self.edit.matrixEditable = false;
          self.matrixKit.query(self.bundleUri + '/matrix/final');
        }
      });
    });

    // finally decide what query to make, depending on the
    $('.save-button', panel).hide();
    $('.create-button', panel).hide();
    $('.create-final-button', panel).hide();
    var queryUri = null;
    if (panId == 'xinitial') {
      $('.jtox-toolkit', panel).show();
      self.edit.matrixEditable = false;
      queryUri = self.bundleUri + '/dataset';
    }
    else {
      var queryPath = (panId == 'xfinal') ? '/matrix/final' : '/matrix/working';
      var m = (panId == 'xfinal') ? 'matrix/final' : 'matrix';
      var editable = (panId == 'xfinal') ? false : true;
      if (self.bundleSummary[m] > 0) {
        $('.jtox-toolkit', panel).show();
        queryUri = self.bundleUri + queryPath;
        self.edit.matrixEditable = editable;
        if (editable) {
          $('.save-button', panel).show();
        }
        else {
          $('.save-button', panel).hide();
        }
      }
      else {
        $('.jtox-toolkit', panel).hide();
        if (self.bundleSummary.matrix > 0) {
          $('.create-final-button', panel).show();
        }
        else {
          $('.create-button', panel).show();
        }
      }
    }

    if (!!queryUri) {
      self.matrixKit.query(queryUri);
    }

  },

  // called when a sub-action in endpoint selection tab is called
  onEndpoint: function (id, panel) {
    var self = this;
    var sub = $(".tab-" + id.substr(3), panel)[0];
    sub.parentNode.style.left = (-sub.offsetLeft) + 'px';
    var bUri = encodeURIComponent(self.bundleUri);

    if (id == "endsubstance") {

      if (!self.substancesQueryKit) {
        self.substancesQueryKit = jT.kit($('#jtox-substance-query')[0]);
        self.substancesQueryKit.setWidget("bundle", self.rootElement);
        self.substancesQueryKit.kit().settings.fixedWidth = '100%';
        self.substancesQueryKit.kit().settings.bUri = self.bundleUri;

        self.substancesQueryKit.kit().settings.configuration.baseFeatures['http://www.opentox.org/api/1.1#ChemicalName'].primary = true;
        self.substancesQueryKit.kit().settings.configuration.baseFeatures['http://www.opentox.org/api/1.1#CASRN'].primary = true;
        self.substancesQueryKit.kit().settings.configuration.baseFeatures['http://www.opentox.org/api/1.1#EINECS'].primary = true;
        self.substancesQueryKit.kit().settings.configuration.baseFeatures['http://www.opentox.org/api/1.1#Reasoning'].primary = true;

        // Modify the #IdRow not to show tag buttons and add #Tag column that show the selected tag.
        self.substancesQueryKit.kit().settings.configuration.baseFeatures['#IdRow'] = { used: true, basic: true, data: "number", column: { "sClass": "center"}, render: function (data, type, full) {
          if (type != 'display')
            return data || 0;
          var html = "&nbsp;-&nbsp;" + data + "&nbsp;-&nbsp;<br/>";
          html += '<span class="jtox-details-open ui-icon ui-icon-folder-collapsed" title="Press to open/close detailed info for this compound"></span>';
          return html;
        } };

        self.substancesQueryKit.kit().settings.configuration.baseFeatures['#Tag'] = { title: 'Tag', used: false, basic: true, visibility: "main", primary: true, column: { "sClass": "center"}, render: function (data, type, full) {

          if (type != 'display')
            return data || 0;

          var html = "";
          var bInfo = full.bundles[self.bundleUri];
          if (!bInfo) {
            return html;
          }
          if (!!bInfo.tag) {
            html += '<button class="jt-toggle active" disabled="true"' + (!bInfo.remarks ? '' : 'title="' + bInfo.remarks + '"') + '>' + (bInfo.tag == 'source' ? 'S' : 'T') + '</button><br />';
          }

          return html;
        } };

        self.substancesQueryKit.kit().settings.configuration.groups.Identifiers.push('#Tag');

        // provid onRow function so the buttons can be set properly...
        self.substancesQueryKit.kit().settings.onRow = function (row, data, index) {
          if (!data.bundles){
            return;
          }
          var bundleInfo = data.bundles[self.bundleUri] || {};
          var noteEl = $('textarea.remark', row);
          if (!!bundleInfo.tag) {
            $('button.jt-toggle.' + bundleInfo.tag.toLowerCase(), row).addClass('active');
            noteEl.val(bundleInfo.remarks);
          }
          noteEl.prop('readonly', true);
        };

        /* Setup expand/collaps all buttons */
        $('#structures-expand-all').on('click', function(){
          $('#jtox-substance-query .jtox-details-open.ui-icon-folder-collapsed').each(function(){
            this.click();
          });
        });
        $('#structures-collapse-all').on('click', function(){
          $('#jtox-substance-query .jtox-details-open.ui-icon-folder-open').each(function(){
            this.click();
          });
        });

      }

      self.substancesQueryKit.kit().queryDataset(self.bundleUri + '/compound');

    }
    else {// i.e. endpoints
      var checkAll = $('input', sub)[0];
      if (sub.childElementCount == 1) {
        var root = document.createElement('div');
        sub.appendChild(root);
        self.endpointKit = new jToxEndpoint(root, {
          selectionHandler: "onSelectEndpoint",
          onRow: function (row, data, index) {
            if (!data.bundles)
              return;
            var bundleInfo = data.bundles[self.bundleUri];
            if (!!bundleInfo && bundleInfo.tag == "selected")
              $('input.jtox-handler', row).attr('checked', 'checked');
          }
        });
        $(checkAll).on('change', function (e) {
          var qUri = "/query/study?bundle_uri=" + bUri;
          if (!this.checked)
            qUri += "&selected=substances&filterbybundle=" + bUri;
          self.endpointKit.loadEndpoints(qUri);
        });
      }
      $(checkAll).trigger('change'); // i.e. initiating a proper reload
    }
  },

  // called when a sub-action in structures selection tab is called
  onStructures: function (id, panel) {
    var self = this;
    if (!self.queryKit) {
      self.queryKit = jT.kit($('#jtox-query')[0]);
      self.queryKit.setWidget("bundle", self.rootElement);
      // provid onRow function so the buttons can be se properly...
      self.queryKit.kit().settings.fixedWidth = '200px';
      self.queryKit.kit().settings.onRow = function (row, data, index) {
        if (!data.bundles)
          return;

        var bundleInfo = data.bundles[self.bundleUri] || {};
        // we need to setup remarks field regardless of bundleInfo presence
        var noteEl = $('textarea.remark', row).on('change', function (e) {
          var data = jT.ui.rowData(this);
          var el = this;
          $(el).addClass('loading');
          jT.service(self, self.bundleUri + '/compound', {
            'method': 'PUT',
            'data': {
              compound_uri: data.compound.URI,
              command: 'add',
              tag: data.bundles[self.bundleUri].tag,
              remarks: $(el).val()
            }
          }, function (result) {
            $(el).removeClass('loading');
          });
        });

        if (!!bundleInfo.tag) {
          $('button.jt-toggle.' + bundleInfo.tag.toLowerCase(), row).addClass('active');
          noteEl.val(bundleInfo.remarks);
        }
        else {
          noteEl.prop('disabled', true).val(' ');
        }
      };

    }

    if (id == 'structlist') {
      self.queryKit.kit().queryDataset(self.bundleUri + '/compound');
    }
    else {
      self.queryKit.query();
    }

  },

  load: function(bundleUri) {
    var self = this;
    jT.call(self, bundleUri, function (bundle) {
      if (!!bundle) {
        bundle = bundle.dataset[0];
        self.bundleUri = bundle.URI;
        self.bundle = bundle;

        ccLib.fillTree(self.createForm, bundle);
        self.starHighlight($('.data-stars-field div', self.createForm)[0], bundle.stars);
        self.createForm.stars.value = bundle.stars;

        // now take care for enabling proper buttons on the Indetifiers page
        self.createForm.assFinalize.style.display = '';
        self.createForm.assNewVersion.style.display = '';
        self.createForm.assStart.style.display = 'none';

        $(self.rootElement).tabs('enable', 1);
        // now request and process the bundle summary
        jT.call(self, bundle.URI + "/summary", function (summary) {
          if (!!summary) {
            for (var i = 0, sl = summary.facet.length; i < sl; ++i) {
              var facet = summary.facet[i];
              self.bundleSummary[facet.value] = facet.count;
            }
          }
          self.progressTabs();
        });
        self.loadUsers();
      }
    });
  },

  loadUsers: function () {
    var self = this;
    var bundle = self.bundle;
    // request and process users with write access
    jT.call(self, self.settings.baseUrl + "/myaccount/users?mode=W&bundle_uri=" + encodeURIComponent(bundle.URI), function (users) {
      if (!!users) {
        var select = $('#users-write');
        select.data('tokenize').clear();
        for (var i = 0, l = users.length; i < l; ++i) {
          var u = users[i];
          select.data('tokenize').tokenAdd(u.id, u.name, true);
        }
      }
    });
    // request and process users with read only access
    jT.call(self, self.settings.baseUrl + "/myaccount/users?mode=R&bundle_uri=" + encodeURIComponent(bundle.URI), function (users) {
      if (!!users) {
        var select = $('#users-read');
        select.data('tokenize').clear();
        for (var i = 0, l = users.length; i < l; ++i) {
          var u = users[i];
          select.data('tokenize').tokenAdd(u.id, u.name, true);
        }
      }
    });
  },

  progressTabs: function () {
    $(this.rootElement).tabs(this.bundleSummary.compound > 0 ? 'enable' : 'disable', 2);
    $(this.rootElement).tabs(this.bundleSummary.substance > 0  && this.bundleSummary.property > 0 ? 'enable' : 'disable', 3);
    if (this.bundleSummary.matrix > 0 || this.bundleSummary['matrix/final'] > 0) {
      $('#xfinal').button('enable');
    }
    else {
      $('#xfinal').button('disable');
    }
  },

  selectStructure: function (uri, what, el) {
    var self = this;
    var activate = !$(el).hasClass('active');
    $(el).addClass('loading');
    var noteEl = $('textarea.remark', self.queryKit.kit().getVarRow(el))[0];
    jT.service(self, self.bundleUri + '/compound', {
      method: 'PUT',
      data: {
        compound_uri: uri,
        command: activate ? 'add': 'delete',
        tag: what,
        remarks: $(noteEl).val()
      }
    }, function (result) {
      $(el).removeClass('loading');
      if (!!result) {
        $(el).toggleClass('active');
        if (activate)
        {
          self.bundleSummary.compound++;
          what = (what == "target" ? "source" : "target");
          $('button.' + what, el.parentNode).removeClass('active');
        }
        else
          self.bundleSummary.compound--;

        $(noteEl).prop('disabled', !activate).val(activate ? "" : " ");
        self.progressTabs();
      }
    });
  },

  structuresLoaded: function (kit, dataset) {
    if (document.body.className == 'structlist') {
      this.bundleSummary.compound = dataset.dataEntry.length;
      this.progressTabs();
    }
  },

  selectSubstance: function (uri, el) {
    var self = this;
    $(el).addClass('loading');
    jT.service(self, self.bundleUri + '/substance', { method: 'PUT', data: { substance_uri: uri, command: el.checked ? 'add' : 'delete' } }, function (result) {
      $(el).removeClass('loading');
      if (!result)
        el.checked = !el.checked; // i.e. revert
      else {
        if (el.checked)
          self.bundleSummary.substance++;
        else
          self.bundleSummary.substance--;
        self.progressTabs();
        console.log("Substance [" + uri + "] selected");
      }
    });
  },

  selectEndpoint: function (topcategory, endpoint, el) {
    var self = this;
    $(el).addClass('loading');
    jT.service(self, self.bundleUri + '/property', {
      method: 'PUT',
      data: {
        'topcategory': topcategory,
        'endpointcategory': endpoint,
        'command': el.checked ? 'add' : 'delete'
      }
    }, function (result) {
      $(el).removeClass('loading');
      if (!result)
        el.checked = !el.checked; // i.e. revert
      else {
        if (el.checked)
          self.bundleSummary.property++;
        else
          self.bundleSummary.property--;
        self.progressTabs();
        console.log("Endpoint [" + endpoint + "] selected");
      }
    });
  }
};

// Now some handlers - they should be outside, because they are called within windows' context.
function onSelectStructure(e) {
  jToxBundle.selectStructure($(this).data('data'), $(this).hasClass('target') ? 'target' : 'source', this);
}

function onBrowserFilled(dataset) {
  jToxBundle.structuresLoaded(this, dataset);
}

function onSelectSubstance(e) {
  jToxBundle.selectSubstance(this.value, this);
}

function onSelectEndpoint(e) {
  var rowData = jT.ui.rowData(this);
  jToxBundle.selectEndpoint(rowData.subcategory, rowData.endpoint, this);
}

function preDetailedRow(index, cell) {

  var self = this;
  var data = this.dataset.dataEntry[index];
  var uri = this.settings.baseUrl + '/substance?type=related&compound_uri=' + encodeURIComponent(data.compound.URI) + '&filterbybundle=' + encodeURIComponent(this.settings.bUri) + '&bundle_uri=' + encodeURIComponent(this.settings.bUri);

  var $row = $(cell.parentNode),
      $idcell = $row.find('td:first-child'),
      $button = $row.find('td:first-child > .jtox-details-open');

  if( !!$(cell).data('details') ) {
    if($(cell).data('details').hasClass('jtox-hidden')){
      $(cell).data('details').removeClass('jtox-hidden');
      $idcell.attr('rowspan', '2');
      $button.removeClass('ui-icon-folder-collapsed').addClass('ui-icon-folder-open');
    }
    else {
      $(cell).data('details').addClass('jtox-hidden');
      $idcell.removeAttr('rowspan');
      $button.addClass('ui-icon-folder-collapsed').removeClass('ui-icon-folder-open');
    }
  }
  else {

    var $cell = $('<td class="paddingless"></td>'),
      $newRow = $('<tr></tr>').append($cell).insertAfter($row).addClass($row[0].className);

    $idcell.attr('rowspan', '2');

    $cell.attr('colspan', $row.find('td:visible').length - 1).removeClass('jtox-hidden');

    var div = document.createElement('div');
    $cell.append(div);

    new jToxSubstance(div, {
      crossDomain: true,
      showDiagrams: true,
      embedComposition: true,
      substanceUri: uri,
      selectionHandler: "onSelectSubstance",
      configuration: jTConfig.matrix,
      onRow: function (row, data, index) {
        if (!data.bundles){
          return;
        }
        var bundleInfo = data.bundles[self.settings.bUri];
        if (!!bundleInfo && bundleInfo.tag == "selected") {
          $('input.jtox-handler', row).prop('checked', true);
        }
      }
    });

    $(cell).data('details', $newRow);

    $button.removeClass('ui-icon-folder-collapsed').addClass('ui-icon-folder-open');
  }

  // Just in case, the variable table is hidden anyway.
  this.equalizeTables();

  return false;
}

function onDetailedRow(row, data, event) {
  var el = $('.jtox-details-composition', row)[0];
  if (!el)
    return;
  var uri = this.settings.baseUrl + '/substance?type=related&compound_uri=' + encodeURIComponent(data.compound.URI);
  el = $(el).parents('table')[0];
  el = el.parentNode;
  $(el).empty();
  $(el).addClass('paddingless');
  var div = document.createElement('div');
  el.appendChild(div);
  new jToxSubstance(div, $.extend(true, {}, this.settings, {crossDomain: true, selectionHandler: null, substanceUri: uri, showControls: false, onLoaded: null, onDetails: function (root, data, element) {
    new jToxStudy(root, $.extend({}, this.settings, {substanceUri: data.URI}));
  } } ) );
}

$(document).ready(function(){
  $('#logger').on('click', function () { $(this).toggleClass('hidden'); });
});
