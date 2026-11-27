"use strict";

const MEDIA = { image: null, scale: 1, fit: true, drag: null };

function prepareMedia(block) {
  for (const image of block.querySelectorAll("img")) {
    image.tabIndex = 0;
    image.setAttribute("role", "button");
    localize(image, () => {
      image.title = translate("Open image preview");
      image.setAttribute("aria-label", image.alt ? translate("Enlarge image {0}", image.alt) : image.title);
    });
    image.draggable = false;
  }
  for (const table of block.querySelectorAll("table")) {
    if (table.parentElement.closest("table")) continue;
    const scroll = document.createElement("div");
    scroll.className = "table-scroll";
    scroll.tabIndex = 0;
    localize(scroll, () => { scroll.setAttribute("aria-label", translate("Table, scroll horizontally")); });
    table.replaceWith(scroll);
    scroll.append(table);
  }
  for (const attachment of block.querySelectorAll("[data-missing-attachment]")) {
    localize(attachment, () => {
      attachment.textContent = translate("[Missing attachment: {0}]", attachment.dataset.missingAttachment || translate("Attachment"));
    });
  }
  for (const download of block.querySelectorAll("[data-download]")) {
    localize(download, () => {
      if (download.hasAttribute("data-attachment-label")) download.textContent = translate("Attachment");
      if (download.dataset.downloadName) download.title = translate("Download {0}", download.dataset.downloadName);
      download.dataset.error = translate("Read failed");
    });
  }
}

async function openImage(image) {
  if (!image.getAttribute("src")) await loadImage(image);
  if (!image.isConnected || !image.getAttribute("src")) return;
  try {
    await image.decode();
  } catch {
    return;
  }
  const preview = document.createElement("img");
  preview.src = image.currentSrc || image.src;
  preview.alt = image.alt;
  preview.draggable = false;
  MEDIA.image = preview;
  MEDIA.fit = true;
  localize($("mediaTitle"), () => { $("mediaTitle").textContent = image.alt || translate("Image"); });
  $("mediaStage").replaceChildren(preview);
  $("mediaDialog").showModal();
  await preview.decode();
  fitMediaImage();
}

function fitMediaImage() {
  if (!MEDIA.image) return;
  const stage = $("mediaStage");
  const image = MEDIA.image;
  MEDIA.fit = true;
  resizeMediaImage(Math.min(1, (stage.clientWidth - 32) / image.naturalWidth,
    (stage.clientHeight - 32) / image.naturalHeight));
}

function resizeMediaImage(scale) {
  const image = MEDIA.image;
  if (!image) return;
  const stage = $("mediaStage");
  const previous = MEDIA.scale;
  const centerX = (stage.scrollLeft + stage.clientWidth / 2) / previous;
  const centerY = (stage.scrollTop + stage.clientHeight / 2) / previous;
  MEDIA.scale = Math.max(0.05, Math.min(8, scale));
  image.style.width = image.naturalWidth * MEDIA.scale + "px";
  image.style.height = image.naturalHeight * MEDIA.scale + "px";
  stage.scrollLeft = centerX * MEDIA.scale - stage.clientWidth / 2;
  stage.scrollTop = centerY * MEDIA.scale - stage.clientHeight / 2;
  $("zoomLevel").textContent = Math.round(MEDIA.scale * 100) + "%";
}

function enableDialogDismiss(dialog) {
  let outside = false;
  const isOutside = event => {
    const bounds = dialog.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom;
  };
  dialog.addEventListener("pointerdown", event => {
    outside = event.target === dialog && isOutside(event);
  });
  dialog.addEventListener("click", event => {
    if (outside && event.target === dialog && isOutside(event)) dialog.close();
    outside = false;
  });
}

function initMedia() {
  $("right").addEventListener("click", event => {
    const image = event.target.closest(".rich img");
    if (image) openImage(image);
  });
  $("right").addEventListener("keydown", event => {
    if (!event.target.matches(".rich img") || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    openImage(event.target);
  });
  enableDialogDismiss($("mediaDialog"));
  $("closeMedia").addEventListener("click", () => $("mediaDialog").close());
  $("mediaDialog").addEventListener("close", () => {
    clearContent($("mediaStage"));
    $("mediaStage").classList.remove("panning");
    MEDIA.image = null;
    MEDIA.drag = null;
  });
  $("zoomIn").addEventListener("click", () => {
    MEDIA.fit = false;
    resizeMediaImage(MEDIA.scale * 1.25);
  });
  $("zoomOut").addEventListener("click", () => {
    MEDIA.fit = false;
    resizeMediaImage(MEDIA.scale / 1.25);
  });
  const stage = $("mediaStage");
  stage.addEventListener("wheel", event => {
    if (!MEDIA.image) return;
    event.preventDefault();
    MEDIA.fit = false;
    resizeMediaImage(MEDIA.scale * Math.exp(-event.deltaY * 0.002));
  }, { passive: false });
  stage.addEventListener("pointerdown", event => {
    if (!MEDIA.image || event.button !== 0) return;
    event.preventDefault();
    MEDIA.drag = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
    stage.setPointerCapture(event.pointerId);
    stage.classList.add("panning");
  });
  stage.addEventListener("pointermove", event => {
    if (!MEDIA.drag) return;
    stage.scrollLeft = MEDIA.drag.left + MEDIA.drag.x - event.clientX;
    stage.scrollTop = MEDIA.drag.top + MEDIA.drag.y - event.clientY;
  });
  stage.addEventListener("lostpointercapture", () => {
    MEDIA.drag = null;
    stage.classList.remove("panning");
  });
  window.addEventListener("resize", () => {
    if (MEDIA.fit) fitMediaImage();
  });
}
