(function () {
  const mainMenu = document.querySelector("#mainMenu");
  const views = [
    document.querySelector("#scalesView"),
    document.querySelector("#transportView"),
    document.querySelector("#degreesView"),
    document.querySelector("#chordsFromDegreesView")
  ];

  const modes = [
    { btn: document.querySelector("#playScalesBtn"), view: document.querySelector("#scalesView"), mode: ScalesMode },
    { btn: document.querySelector("#playTransportBtn"), view: document.querySelector("#transportView"), mode: TransportMode },
    { btn: document.querySelector("#playDegreesBtn"), view: document.querySelector("#degreesView"), mode: DegreesMode },
    {
      btn: document.querySelector("#playChordsFromDegreesBtn"),
      view: document.querySelector("#chordsFromDegreesView"),
      mode: ChordsFromDegreesMode
    }
  ];

  function hideAllViews() {
    views.forEach((view) => view.classList.add("hidden"));
  }

  function showView(view) {
    mainMenu.classList.add("hidden");
    hideAllViews();
    view.classList.remove("hidden");
  }

  function showMenu() {
    modes.forEach(({ mode }) => mode.teardown());
    hideAllViews();
    mainMenu.classList.remove("hidden");
  }

  modes.forEach(({ btn, view, mode }) => {
    btn.addEventListener("click", () => {
      showView(view);
      mode.start();
    });
  });

  document.addEventListener("app:back-to-menu", showMenu);
})();
