async function startWindowDrag(event: PointerEvent): Promise<void> {
  if (event.button !== 0 || !window.stickyDesktop?.getWindowBounds) {
    return;
  }

  const requestId = windowDrag.requestId + 1;
  windowDrag.requestId = requestId;
  const bounds = await window.stickyDesktop.getWindowBounds();
  if (!bounds || requestId !== windowDrag.requestId) {
    return;
  }

  windowDrag.active = true;
  windowDrag.pointerId = event.pointerId;
  windowDrag.originX = bounds.x;
  windowDrag.originY = bounds.y;
  windowDrag.startScreenX = event.screenX;
  windowDrag.startScreenY = event.screenY;
  windowDrag.currentX = bounds.x;
  windowDrag.currentY = bounds.y;
  windowDrag.moved = false;
  document.body.classList.add("is-dragging-window");
}

function handleWindowDragMove(event: PointerEvent): void {
  if (!windowDrag.active || event.pointerId !== windowDrag.pointerId) {
    return;
  }

  const deltaX = event.screenX - windowDrag.startScreenX;
  const deltaY = event.screenY - windowDrag.startScreenY;
  if (!windowDrag.moved && Math.abs(deltaX) + Math.abs(deltaY) < 4) {
    return;
  }

  windowDrag.moved = true;
  windowDrag.currentX = windowDrag.originX + deltaX;
  windowDrag.currentY = windowDrag.originY + deltaY;
  window.stickyDesktop?.setWindowPosition(windowDrag.currentX, windowDrag.currentY);
}

function stopWindowDrag(event?: PointerEvent): void {
  if (!windowDrag.active && windowDrag.pointerId == null) {
    return;
  }

  if (event && event.pointerId != null && windowDrag.pointerId != null && event.pointerId !== windowDrag.pointerId) {
    return;
  }

  if (event && windowDrag.active && windowDrag.pointerId != null && event.pointerId === windowDrag.pointerId) {
    const deltaX = event.screenX - windowDrag.startScreenX;
    const deltaY = event.screenY - windowDrag.startScreenY;
    windowDrag.currentX = windowDrag.originX + deltaX;
    windowDrag.currentY = windowDrag.originY + deltaY;
  }

  if (windowDrag.moved) {
    void window.stickyDesktop?.snapWindowPosition(windowDrag.currentX, windowDrag.currentY);
  }

  windowDrag.requestId += 1;
  windowDrag.active = false;
  windowDrag.pointerId = null;
  windowDrag.moved = false;
  document.body.classList.remove("is-dragging-window");
}
