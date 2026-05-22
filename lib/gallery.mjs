// Decide grid cell span for a media item given its pixel dimensions.
// Landscape (w/h > 1.4): span 2 columns. Portrait (h/w > 1.4): span 2 rows.
// Otherwise: 1x1. Missing/zero dims also fall back to 1x1.
export function sizeFor(item) {
  const w = Number(item?.w) || 0;
  const h = Number(item?.h) || 0;
  if (!w || !h) return { colSpan: 1, rowSpan: 1 };
  const ratio = w / h;
  if (ratio > 1.4)  return { colSpan: 2, rowSpan: 1 };
  if (1 / ratio > 1.4) return { colSpan: 1, rowSpan: 2 };
  return { colSpan: 1, rowSpan: 1 };
}

function mediaTileHTML(item, idx) {
  const { colSpan, rowSpan } = sizeFor(item);
  const style = `grid-column:span ${colSpan};grid-row:span ${rowSpan};`;
  const bg = item.type === "video" ? (item.poster || item.src) : item.src;
  const playOverlay = item.type === "video" ? `<span class="play-overlay" aria-hidden="true">▶</span>` : "";
  return `
    <button type="button" class="tile" data-idx="${idx}" style="${style}background-image:url('${bg}')">
      ${playOverlay}
    </button>
  `;
}

// Mounts the grid for one stop into its container.
// onTileClick is called with (stop, mediaIndex) when a tile is tapped.
export function mountGallery(stop, container, onTileClick) {
  container.innerHTML = stop.media.map(mediaTileHTML).join("");
  container.addEventListener("click", e => {
    const btn = e.target.closest(".tile");
    if (!btn) return;
    onTileClick(stop, Number(btn.dataset.idx));
  });
}
