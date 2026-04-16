const burger = document.getElementById("burger");
const lines = document.querySelectorAll(".burger-line");

burger.addEventListener("click", menu);

let ismenuOpen = false;

const menu = () => {
    const nav = document.querySelector("nav");

    if (ismenuOpen === false) {
        nav.style.display = "flex";
        burger.classList.add("active");
        ismenuOpen = true;
    } else {
        nav.style.display = "none";
        burger.classList.remove("active");
        ismenuOpen = false;
    }
}