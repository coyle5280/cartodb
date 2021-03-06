/* global $:false, _:false */

/**
 *  Edit visualization (dataset or map) dialog
 *
 */
cdb.admin.MetadataForm = cdb.core.View.extend({
  className: 'metadata-form',

  options: {
    maxLength: 200
  },

  events: {
    'blur input': '_queueSubmit',
    'blur textarea': '_onSubmit'
  },

  initialize: function () {
    this.user = this.options.user;
    this.vis = this.options.vis;
    this.template = cdb.templates.getTemplate('table/menu_modules/edit_vis_metadata/edit_vis_form');
    this.model = new cdb.core.MetadataModel({
      vis: this.vis,
      user: this.user,
      dataLayer: this.options.dataLayer
    });

    this._initBinds();
  },

  render: function () {
    this.clearSubViews();
    this._destroyTags();
    this.$el.html(
      this.template({
        isDataset: this.model.isDataset(),
        isDataLibraryEnabled: this.user.featureEnabled('data_library'),
        visDescription: this.model.get('description'),
        visPrivacy: this.model.get('privacy').toLowerCase(),
        visSource: this.model.get('source'),
        visAttributions: this.model.get('attributions'),
        isMetadataEditable: this.model.isMetadataEditable(),
        maxLength: this.options.maxLength
      })
    );
    this._initViews();
    return this;
  },

  _initBinds: function () {
    this.model.bind('error', this._setFields, this);
    this.model.bind('valid', this._setFields, this);
  },

  _initViews: function () {
    var self = this;

    // Markdown tooltip
    this.addView(
      new cdb.common.TipsyTooltip({
        el: this.$('.js-markdown'),
        html: true,
        title: function () {
          return $(this).data('title');
        }
      })
    );

    // Tags
    _.each(this.model.get('tags'), function (li) {
      this.$('.js-tagsList').append('<li>' + cdb.core.sanitize.html(li) + '</li>');
    }, this);

    var tagsPlaceholder = (!this.model.isMetadataEditable() && this.model.get('tags').length === 0) ? 'No tags' : 'Add tags';

    this.$('.js-tagsList').tagit({
      allowSpaces: true,
      placeholderText: tagsPlaceholder,
      readOnly: !this.model.isMetadataEditable(),
      onBlur: function () {
        if (self.model.isMetadataEditable()) {
          self.$('.js-tags').removeClass('is-focus');
        }
      },
      onFocus: function () {
        if (self.model.isMetadataEditable()) {
          self.$('.js-tags').addClass('is-focus');
        }
      },
      onSubmitTags: function (ev, tagList) {
        ev.preventDefault();
        self._onSubmit();
        return false;
      }
    });

    // Licenses dropdown
    if (this.model.isDataset()) {
      this._licenseDropdown = new cdb.forms.Combo({
        className: 'Select',
        width: '100%',
        property: 'license',
        model: this.model,
        disabled: !this.model.isMetadataEditable(),
        extra: this._getLicensesForFormsCombo()
      });
      this.addView(this._licenseDropdown);
      this.$('.js-license').append(this._licenseDropdown.render().el);
    }
  },

  _getLicensesForFormsCombo: function () {
    var items = cdb.config.get('licenses');
    var emptyOption = [{
      id: '',
      name: 'Select a license...'
    }];
    return _.chain(emptyOption.concat(items))
      .compact()
      .map(function (d) {
        return [d.name, d.id];
      })
      .value();
  },

  _showPrivacy: function (ev) {
    this.killEvent(ev);
    this.trigger('onPrivacy', this);
  },

  // Form events

  _queueSubmit: function (ev) {
    // By adding a new event, we guarentee that this will execute after the
    // current event resolves.
    // See http://stackoverflow.com/a/7760544
    window.setTimeout(this._onSubmit.bind(this), 0);
  },

  _onSubmit: function (ev) {
    if (ev) {
      this.killEvent(ev);
    }

    // values
    var attrs = {};
    if (this.model.isMetadataEditable()) {
      // collect changed attributes
      attrs['name'] = this.vis.get('name');
      attrs['description'] = cdb.Utils.removeHTMLEvents(this.$('.js-description').val());
      attrs['tags'] = this.$('.js-tagsList').tagit('assignedTags');

      if (this.model.isDataset()) {
        attrs.source = this.$('.js-source').val();
        attrs.attributions = this.$('.js-attributions').val();
      // license is set through dropdown view, so no need to do an explicit set here
      }
    }

    // Set and save attributes
    this.model.set(attrs);
    var oldAttrs = this.vis.attributes;
    if (!_.isEmpty(this.vis.changedAttributes(attrs))) {
      this.vis.set(attrs);
      this.vis.save({}, {
        error: function () {
          this.vis.set(oldAttrs);
        }
      });
    }
  },

  // Clean functions

  _destroyTags: function () {
    this.$('.js-tagsList').tagit('destroy');
  },

  clean: function () {
    this._destroyTags();
    this.elder('clean');
  }

});
