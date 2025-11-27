// Flyer vergrößern / schließen
const flyerPopup = document.getElementById("flyer-popup");
const flyerPopupImg = document.getElementById("flyer-popup-img");
const flyerClose = document.querySelector(".flyer-close");
const flyerImgs = document.querySelectorAll(".flyer-img");

flyerImgs.forEach(img => {
  img.addEventListener("click", () => {
    flyerPopup.style.display = "flex";
    flyerPopupImg.src = img.src;
  });
});

flyerClose.addEventListener("click", () => {
  flyerPopup.style.display = "none";
});

// Schließen bei Klick außerhalb des Bildes
flyerPopup.addEventListener("click", e => {
  if (e.target === flyerPopup) flyerPopup.style.display = "none";
});
