/**
 * dropdown when user clicks on a filter sort option
 */
cdb.admin.FilterSortDropdown = cdb.admin.DropdownMenu.extend({

  className: "dropdown border",

  isPublic: false,
  events: {
      "click  .sortAToZ":           "_sort_az",
      "click  .sortHighToLow":      "_sort_high_low"
  },

  initialize: function() {
    this.sortValue = "HighLowAZ";
    this.elder('initialize');
  },
_sort_az: function(e) {
  e.preventDefault();
  this.sortValue = "AZ";
  this.trigger('sortChange', 'AZ');
  this.hide();
  return false;
},
_sort_high_low: function(e) {
  e.preventDefault();
  this.sortValue = "HighLowAZ";
  this.trigger('sortChange', 'HighLowAZ');
  this.hide();
  return false;
},

render: function() {
    cdb.admin.DropdownMenu.prototype.render.call(this);
    if(this.sortValue === "HighLowAZ"){
      this.$el.find('.sortAToZ').show();
      this.$el.find('.sortHighToLow').hide(); 
    }else{
      this.$el.find('.sortAToZ').hide();
      this.$el.find('.sortHighToLow').show(); 
    }
    return this;
}

});