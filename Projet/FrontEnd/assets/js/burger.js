const burger = document.getElementById("burger");
const nav = document.querySelector("nav");
let ismenuOpen = false;

const toggleMenu = () => {
    if (!ismenuOpen) {
        nav.style.display = "flex";
        ismenuOpen = true;
    } else {
        nav.style.display = "none";
        ismenuOpen = false;
    }
};

burger.addEventListener("click", toggleMenu);