const escapeHtml = (value) =>
    String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

const setActiveNav = (root) => {
    const links = root.querySelectorAll("a[data-nav]");
    const here = new URL(window.location.href);
    for (const link of links) {
        try {
            const target = new URL(link.getAttribute("href"), window.location.href);
            const isSame = target.pathname === here.pathname;
            if (isSame) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        } catch {
            link.removeAttribute("aria-current");
        }
    }
};

class SiteHeader extends HTMLElement {
    connectedCallback() {
        const title = escapeHtml(this.getAttribute("title") || "Forum");
        const subtitle = escapeHtml(this.getAttribute("subtitle") || "Welcome");

        this.innerHTML = `
<header class="site-header">
  <div class="container site-header__bar">
    <a class="site-brand" href="#" data-home aria-label="Home">
      <span class="site-brand__mark" aria-hidden="true"></span>
      <span>
        <span class="site-brand__text">${title}</span>
        <span class="site-brand__sub">${subtitle}</span>
      </span>
    </a>

    <div class="site-actions">
      <nav class="site-nav" aria-label="Primary">
        <a href="#" data-nav data-login-link>Login</a>
        <a href="#" data-nav data-register-link>Register</a>
      </nav>
      <button class="icon-btn menu-btn" type="button" aria-label="Menu" aria-expanded="false" aria-controls="mobile-drawer">
        <span class="menu-btn__lines" aria-hidden="true"><span></span><span></span><span></span></span>
      </button>
    </div>
  </div>
</header>

<div class="mobile-drawer" id="mobile-drawer" hidden>
  <div class="container mobile-drawer__inner">
    <div class="mobile-drawer__meta">Account</div>
    <a href="#" data-nav data-login-link>Login <span aria-hidden="true">↗</span></a>
    <a href="#" data-nav data-register-link>Register <span aria-hidden="true">↗</span></a>
    <a href="#" data-nav data-ban-link>Ban page <span aria-hidden="true">↗</span></a>
  </div>
</div>
`;

        const resolve = (value) => {
            const base = this.getAttribute("base");
            try {
                return new URL(value, base ? new URL(base, window.location.href) : window.location.href).toString();
            } catch {
                return value;
            }
        };

        const home = this.querySelectorAll("[data-home]");
        const login = this.querySelectorAll("[data-login-link]");
        const register = this.querySelectorAll("[data-register-link]");
        const ban = this.querySelectorAll("[data-ban-link]");

        for (const el of home) el.setAttribute("href", resolve("./login.html"));
        for (const el of login) el.setAttribute("href", resolve("./login.html"));
        for (const el of register) el.setAttribute("href", resolve("./register.html"));
        for (const el of ban) el.setAttribute("href", resolve("./ban.html"));

        const menuBtn = this.querySelector(".menu-btn");
        const drawer = this.querySelector("#mobile-drawer");

        const openDrawer = () => {
            if (!drawer.hasAttribute("hidden")) return;
            drawer.removeAttribute("hidden");
            menuBtn.setAttribute("aria-expanded", "true");
        };
        const closeDrawer = () => {
            if (drawer.hasAttribute("hidden")) return;
            drawer.setAttribute("hidden", "");
            menuBtn.setAttribute("aria-expanded", "false");
        };

        menuBtn?.addEventListener("click", () => {
            const expanded = menuBtn.getAttribute("aria-expanded") === "true";
            if (expanded) closeDrawer();
            else openDrawer();
        });

        window.addEventListener(
            "resize",
            () => {
                if (window.innerWidth > 900) closeDrawer();
            },
            { passive: true }
        );

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeDrawer();
        });

        document.addEventListener("click", (event) => {
            if (drawer.hasAttribute("hidden")) return;
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (this.contains(target)) return;
            closeDrawer();
        });

        setActiveNav(this);
    }
}

class SiteFooter extends HTMLElement {
    connectedCallback() {
        const title = escapeHtml(this.getAttribute("title") || "Forum");
        const year = String(new Date().getFullYear());

        this.innerHTML = `
<footer class="site-footer">
  <div class="container site-footer__inner">
    <div class="footer-brand">
      <div class="footer-brand__title">
        <span class="site-brand__mark" aria-hidden="true"></span>
        <span>${title}</span>
      </div>
      <p class="footer-brand__tagline">Clean, responsive forum chrome with shared header and footer.</p>
    </div>

    <div class="footer-col">
      <h4>Account</h4>
      <ul class="footer-links">
        <li><a href="#" data-login-link>Login</a></li>
        <li><a href="#" data-register-link>Register</a></li>
      </ul>
    </div>

    <div class="footer-col">
      <h4>Pages</h4>
      <ul class="footer-links">
        <li><a href="#" data-ban-link>Ban</a></li>
      </ul>
    </div>

    <div class="footer-col" aria-hidden="true"></div>
  </div>

  <div class="container footer-bottom">
    <div>© <span data-year>${year}</span> ${title}. All rights reserved.</div>
    <div class="footer-bottom__right">
      <button class="back-to-top" type="button" data-top>Back to top</button>
    </div>
  </div>
</footer>
`;

        const resolve = (value) => {
            const base = this.getAttribute("base");
            try {
                return new URL(value, base ? new URL(base, window.location.href) : window.location.href).toString();
            } catch {
                return value;
            }
        };

        const setAll = (selector, href) => {
            for (const el of this.querySelectorAll(selector)) el.setAttribute("href", resolve(href));
        };

        setAll("[data-login-link]", "./login.html");
        setAll("[data-register-link]", "./register.html");
        setAll("[data-ban-link]", "./ban.html");

        this.querySelector("[data-top]")?.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }
}

if (!customElements.get("site-header")) customElements.define("site-header", SiteHeader);
if (!customElements.get("site-footer")) customElements.define("site-footer", SiteFooter);
