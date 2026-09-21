Upgrading from grid-editor `1.*` to `2.*`
=========================================

Grid-editor `1.*` is for bootstrap __4__, `2.*` for bootstrap __5__.

The grid classes grid-editor generates (`col-lg-*`, `col-sm-*`, `col-*`) are
valid in both bootstrap 4 and 5, so __no changes to your generated HTML are
needed__. What changes is what you load on the page:

* Load __bootstrap 5__ instead of bootstrap 4. The layout mode dropdown now
  uses `data-bs-toggle` instead of `data-toggle`, which only bootstrap 5
  understands.
* Load [bootstrap icons](https://icons.getbootstrap.com/) instead of font
  awesome. Every built-in tool icon moved from a `fa fa-*` class to its
  `bi bi-*` equivalent.
* If you pass custom `row_tools` or `col_tools`, their default `iconClass` is
  now `bi bi-wrench`. Any `iconClass` you pass explicitly as `fa fa-*` must be
  changed to a bootstrap icons class.

Upgrading from grid-editor `0.*` to `1.*`
=========================================

Grid-editor `0.*` is for bootstrap __3__, `1.*` for bootstrap __4__.
Since the breakpoints for the gridsystem have changed from 3 to 4, all the HTML that was generated using grid-editor `0.*` must be adjusted.
Change all the classes in the HTML from `col-md` to `col-lg`. No other changes to the HTML are needed.
