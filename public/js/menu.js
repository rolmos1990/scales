(function () {
  const mainMenu = document.querySelector("#mainMenu");
  const scalesView = document.querySelector("#scalesView");
  const transportView = document.querySelector("#transportView");
  const playScalesBtn = document.querySelector("#playScalesBtn");
  const playTransportBtn = document.querySelector("#playTransportBtn");

  function showView(view) {
    mainMenu.classList.add("hidden");
    scalesView.classList.add("hidden");
    transportView.classList.add("hidden");
    view.classList.remove("hidden");
  }

  function showMenu() {
    ScalesMode.teardown();
    TransportMode.teardown();
    scalesView.classList.add("hidden");
    transportView.classList.add("hidden");
    mainMenu.classList.remove("hidden");
  }

  playScalesBtn.addEventListener("click", () => {
    showView(scalesView);
    ScalesMode.start();
  });

  playTransportBtn.addEventListener("click", () => {
    showView(transportView);
    TransportMode.start();
  });

  document.addEventListener("app:back-to-menu", showMenu);
})();
