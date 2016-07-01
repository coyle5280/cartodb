  /**
   *  Layer panel view added in the right menu
   *
   *  - It needs at least layer, visualization and user models.
   *    Globalerror to show connection or fetching errors.
   *
   *  var layer_view = new cdb.admin.LayerPanelView({
   *    model:        layer_model,
   *    vis:          vis_model,
   *    user:         user_model,
   *    globalError:  globalError_obj
   *  });
   */


  cdb.admin.MetadataPanelView = cdb.admin.RightMenu.extend({

    initialize: function() {

      this.view_model = this.options.model;
      this.table = this.options.model.get('table');
      this.sqlView = this.options.model.get('sqlView');
      this.vis = this.options.vis;
      this.map = this.vis.map;
      this.user = this.options.user;
      this.dataLayer = this.map.get('dataLayer');

      cdb.admin.RightMenu.prototype.initialize.call(this);

      this.render();

      this._addMetadataForm();
      this._addMapOptions();
    },

    /* Layer events functions */

    setPanelStatus: function() {
      this.view_model.set('state', 'idle');
    },

    /* View visibility functions */

    hide: function() {
      this.$('.layer-sidebar').hide();
      this.$('.layer-views').hide();
    },

    show: function() {
      this.$('.layer-sidebar').show();
      this.$('.layer-views').show();
    },

    // showModule: function(modName, modTab) {
    //   // Set tab in the module
    //   if (modTab && this[modName]) this[modName].setActiveTab(modTab);
    //   // Show module
    //   this.trigger('show', modName + "_mod", this);
    // },

    clean: function() {
      this._unsetLayerTooltip();
      this._removeButtons();
      this.elder('clean');
    },

    _addMapOptions: function() {
      if (!this.mapOptionsDropdown) {
        this.mapOptionsDropdown = new cdb.admin.MapOptionsDropdown({
          target:              this.$el,
          template_base:       "table/views/map_options_dropdown",
          table:               this.vis.get('table'),
          model:               this.map,
          collection:          this.vis.overlays,
          user:                this.user,
          vis:                 this.vis,
          position:            "position",
          vertical_position:   "down",
          horizontal_position: "right",
          horizontal_offset:   "3px"
        });

        this.mapOptionsDropdown.bind("createOverlay", function(overlay_type, property) {
          this.vis.overlays.createOverlayByType(overlay_type, property);
        }, this);

        this.addView(this.mapOptionsDropdown);

        this.$el.append(this.mapOptionsDropdown.render().el);
      }
    },

    _addMetadataForm: function() {
      if (!this.metadataForm) {
        // Renders and disappears equal to map options
        this.metadataForm = new cdb.admin.MetadataForm({
          user:        this.user,
          model:       this.map,
          vis:         this.vis,
          dataLayer:   this.dataLayer
        });
        this.addView(this.metadataForm);
        this.$el.append(this.metadataForm.render().el);
      }
    },

  });
