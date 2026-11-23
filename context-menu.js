// Items of the context menu (see 'context menu' in main.js), from the
// parameters of Electron's 'context-menu' event. Returns null when there
// is no menu, otherwise a list of items:
//   { key, action, enabled, accelerator }  edit command on the clicked page
//                                          (contents[action]()), label edit.<key>
//   { key: 'copyImage' }                   copies the image at the click
//   { key: 'openLink', url }               asks the page to add it as a tab
//   { key: 'copyLink', url }               copies the address
//   { type: 'separator' }
// `overlayPage`: the click is in the overlay's own page (not a site's);
// `platform`: process.platform (the Redo accelerator).

const TEXT_CONTROLS = new Set(['input-text', 'input-url', 'input-search', 'input-email', 'input-telephone', 'input-number', 'text-area']);

function contextMenuItems(params, { overlayPage, platform }) {
  const readOnlyText = overlayPage
    ? TEXT_CONTROLS.has(params.formControlType) || params.selectionText !== ''
    : true;
  if (!params.isEditable && !readOnlyText) return null;
  const flags = params.editFlags ?? {};
  const item = (key, enabled, accelerator) => ({ key, action: key, enabled: !!enabled, accelerator });
  const copy = item('copy', flags.canCopy, 'CmdOrCtrl+C');
  const selectAll = item('selectAll', flags.canSelectAll, 'CmdOrCtrl+A');
  const items = params.isEditable
    ? [
        item('undo', flags.canUndo, 'CmdOrCtrl+Z'),
        item('redo', flags.canRedo, platform === 'win32' ? 'Ctrl+Y' : 'CmdOrCtrl+Shift+Z'),
        { type: 'separator' },
        item('cut', flags.canCut, 'CmdOrCtrl+X'),
        copy,
        item('paste', flags.canPaste, 'CmdOrCtrl+V'),
        selectAll,
      ]
    : [copy, selectAll];
  const page = !overlayPage && !params.isEditable;
  if (page && params.mediaType === 'image' && params.hasImageContents) {
    items.unshift({ key: 'copyImage' }, { type: 'separator' });
  }
  const link = page ? params.linkURL : '';
  if (link) {
    items.unshift(
      ...(/^https?:/i.test(link) ? [{ key: 'openLink', url: link }] : []),
      { key: 'copyLink', url: link },
      { type: 'separator' },
    );
  }
  return items;
}

module.exports = { contextMenuItems };
