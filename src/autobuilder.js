/**
 * Set default priorities mode and configuration
 * modes: balanced OR unbalanced OR queue
 *
 * queue: temporary buildings you can add by the panel
 * balanced: alternate between items keeping them upgrading together
 * unbalanced: upgrade the maximum every building one by one
 */
const _customscript_watcher_priorities = {
  queue: [],
  balanced: [],
  // balanced: ["main_buildrow_wood", "main_buildrow_stone", "main_buildrow_iron"],
  unbalanced: [],
};
var _customscript_watcher_nextBuildingBuffer = null;
var _customscript_watcher_buildingsBuffer = null;
var _customscript_watcher_schedulerON = false;

/**
 * Calculate the current building timeleft
 * if no current buildings in queue returns [-1, -1, -1]
 *
 * @returns Array containing [hours, minutes, seconds]
 */
const _customscript_watcher_timeleft = () => {
  try {
    const timeleft = document
      .querySelector("span[data-endtime]")
      .innerHTML.split(":")
      .map((n) => parseInt(n));
    return timeleft;
  } catch (err) {
    return [-1, -1, -1];
  }
};

/**
 * Call itself every 1 second updating the DOM
 * also calling the scheduler if enabled
 */
const _customscript_watcher = () => {
  const [h, m, s] = _customscript_watcher_timeleft();

  if (h == 0 && m < 3) {
    document
      .querySelector("td.lit-item a.order_feature.btn.btn-btr.btn-instant-free")
      .click();
  }

  setTimeout(() => {
    if (_customscript_watcher_schedulerON) _customscript_watcher_runScheduler();
    _customscript_watcher_updateDOM();
    _customscript_watcher();
  }, 1000);
};

/**
 * Create the DOM display elements and appends in body
 */
const _customscript_watcher_buildDOM = () => {
  const span = document.createElement("div");
  const dynamicContent = document.createElement("span");
  const staticContent = document.createElement("span");

  span.style =
    "position:fixed;bottom:0;right:0;padding:.5em;background-color:#333333a0;color:white;z-index:100000";
  dynamicContent.style = "display:block;margin-bottom:1rem;";
  staticContent.style = "display:block;";

  span.id = "_customscript_watcher_displayDOM";
  dynamicContent.id = "_customscript_watcher_displayDynamicDOM";
  staticContent.id = "_customscript_watcher_displayStaticDOM";

  document.body.appendChild(span);
  span.appendChild(dynamicContent);
  span.appendChild(staticContent);

  let cachedQueue = window.localStorage.getItem("_customscript_watcher_queue");
  if (cachedQueue)
    _customscript_watcher_priorities.queue = JSON.parse(cachedQueue);
};

/**
 * Update the DOM display based on a key-value list of
 * informations
 *
 * If the key-value is null, the key is not rendered
 *
 * Also renders the static list of buildings so the user
 * can interact without flicking on update
 */
const _customscript_watcher_updateDOM = () => {
  const dynamicContent = document.querySelector(
    "#_customscript_watcher_displayDynamicDOM"
  );
  const staticContent = document.querySelector(
    "#_customscript_watcher_displayStaticDOM"
  );
  const data = { ..._customscript_watcher_buildInfoList() };
  const buildings = _customscript_watcher_getBuildingsList();

  dynamicContent.innerHTML = data.title;
  delete data.title;
  Object.keys(data).forEach((k) => {
    if (data[k])
      dynamicContent.innerHTML = `${dynamicContent.innerHTML}<br>${k}: ${data[k]}`;
  });

  if (
    JSON.stringify(buildings) !==
    JSON.stringify(_customscript_watcher_buildingsBuffer)
  ) {
    let staticContentHTML = "";
    let selectOptions = buildings
      .map((b) => `<option value="${b.id}">${b.name}</option>`)
      .join("");

    staticContentHTML = `
    <select id="_customscript_watcher_selectBuildingDOM">${selectOptions}</select>
    <button id="_customscript_watcher_pushToQueueButtonDOM">ADD</button>
    <button id="_customscript_watcher_popFromQueueButtonDOM">REM</button>
    <br>
    Scheduler <button id="_customscript_watcher_schedulerToggleButtonDOM">OFF</button>
    `;

    staticContent.innerHTML = staticContentHTML;

    const addToQueueButtonDOM = document.querySelector(
      "#_customscript_watcher_pushToQueueButtonDOM"
    );

    if (addToQueueButtonDOM) {
      addToQueueButtonDOM.removeEventListener(
        "click",
        _customscript_watcher_pushToQueueOnce
      );
      addToQueueButtonDOM.addEventListener(
        "click",
        _customscript_watcher_pushToQueueOnce
      );
    }
    const popFromQueueButtonDOM = document.querySelector(
      "#_customscript_watcher_popFromQueueButtonDOM"
    );

    if (popFromQueueButtonDOM) {
      popFromQueueButtonDOM.removeEventListener(
        "click",
        _customscript_watcher_popFromQueueOnce
      );
      popFromQueueButtonDOM.addEventListener(
        "click",
        _customscript_watcher_popFromQueueOnce
      );
    }

    const toggleSchedulerButtonDOM = document.querySelector(
      "#_customscript_watcher_schedulerToggleButtonDOM"
    );
    if (toggleSchedulerButtonDOM) {
      toggleSchedulerButtonDOM.onclick =
        _customscript_watcher_toggleSchedulerONOFF;
    }

    _customscript_watcher_buildingsBuffer = buildings;
  }
};

/**
 * Generate info list of dynamic data to be displayed
 * on the right bottom side of the page
 *
 * @returns An object of data to be displayed
 */
const _customscript_watcher_buildInfoList = () => {
  const title = "Watching";

  const resources = _customscript_watcher_getMainResources();
  const [h, m, s] = _customscript_watcher_timeleft();

  return {
    title,
    resources: Object.values(resources).join(","),
    jump_remaining:
      h == -1
        ? null
        : `${h < 10 ? `0${h}` : h}:${m - 3 < 10 ? `0${m - 3}` : m - 3}:${
            s < 10 ? `0${s}` : s
          }`,
    next_building: _customscript_watcher_nextBuildingBuffer?.name,
    queued:
      _customscript_watcher_priorities.queue.length > 0
        ? `<table>${_customscript_watcher_priorities.queue
            .map((id) => `<tr><td>${id}</td></tr>`)
            .join("")}</table>`
        : null,
  };
};

/**
 * Extracts from DOM the list of buildings available for
 * built/upgrades
 *
 * @returns A list of buildings containing {name, id, level, resources}
 */
const _customscript_watcher_getBuildingsList = () => {
  const buildings = [
    ...document.querySelectorAll("#buildings tr:not(:first-child)"),
  ].filter((b) => b.querySelectorAll("td").length > 2);

  return buildings.map((b) => {
    let name = b
      .querySelector("td:first-child img:first-child")
      .getAttribute("data-title");

    let id = b.id;

    let level = -1;
    try {
      level = parseInt(
        b
          .querySelector("td:first-child span:last-child")
          .innerHTML.match(/([0-9]+)/)[0]
      );
    } catch (err) {
      console.log(err);
    }

    let resources = {
      wood: parseInt(b.querySelector("td.cost_wood").getAttribute("data-cost")),
      stone: parseInt(
        b.querySelector("td.cost_stone").getAttribute("data-cost")
      ),
      iron: parseInt(b.querySelector("td.cost_iron").getAttribute("data-cost")),
    };

    let duration = 100000000;

    try {
      duration = b
        .querySelector(".cost_iron~td")
        .innerHTML.match(/([0-9]+):([0-9]+):([0-9]+)/)[0]
        .split(":")
        .map((s, i) => parseInt(s) * (i == 0 ? 3600 : i == 1 ? 60 : 1))
        .reduce((prev, cur) => prev + cur, 0);
    } catch (err) {
      console.log(err);
    }

    return {
      name,
      id,
      level,
      resources,
      duration,
    };
  });
};

/**
 * Calculate the next building to be scheduled, based on
 * the initial priority configuration
 *
 * Queue algorithm -> first in first out
 * Balanced algorithm -> upgrade building keeping them all in the same level
 * Unbalanced algorithim -> always upgrade the first available
 *
 * @returns A building from the list of buildings
 */
const _customscript_watcher_getNextBuilding = () => {
  const buildingsList = _customscript_watcher_getBuildingsList();
  const mainResources = _customscript_watcher_getMainResources();

  const filteredResources = buildingsList.filter(
    (b) =>
      b.resources.wood <= mainResources.wood &&
      b.resources.stone <= mainResources.stone &&
      b.resources.iron <= mainResources.iron
  );
  let resultantList = [];

  if (_customscript_watcher_priorities.queue.length > 0) {
    resultantList = filteredResources.filter((b) =>
      _customscript_watcher_priorities.queue.includes(b.id)
    );

    for (let [
      idx,
      queuedBuilding,
    ] of _customscript_watcher_priorities.queue.entries()) {
      let found = resultantList.find((b) => b.id == queuedBuilding);

      if (found) {
        _customscript_watcher_priorities.queue.splice(idx, 1);
        return found;
      }
    }
  }

  if (_customscript_watcher_priorities.balanced.length > 0) {
    resultantList = filteredResources
      .filter((b) => _customscript_watcher_priorities.balanced.includes(b.id))
      .sort((a, b) => (a.level < b.level ? -1 : 1));

    return resultantList[0];
  }

  if (_customscript_watcher_priorities.unbalanced.length > 0) {
    resultantList = filteredResources.filter((b) =>
      _customscript_watcher_priorities.unbalanced.includes(b.id)
    );

    let candidate = _customscript_watcher_priorities.unbalanced.shift();
    _customscript_watcher_priorities.unbalanced.push(candidate);

    return candidate;
  }

  return filteredResources.sort((a, b) =>
    a.duration < b.duration ? -1 : 1
  )[0];
};

/**
 * Extracts from DOM the user's resources
 *
 * @returns An object containing user resources {wood, stone, iron}
 */
const _customscript_watcher_getMainResources = () => {
  const wood = parseInt(document.querySelector("#wood").innerHTML);
  const stone = parseInt(document.querySelector("#stone").innerHTML);
  const iron = parseInt(document.querySelector("#iron").innerHTML);

  return {
    wood,
    stone,
    iron,
  };
};

/**
 * Push item selected in display to queue once list
 */
const _customscript_watcher_pushToQueueOnce = () => {
  console.log(
    "ADDING ",
    document.querySelector("#_customscript_watcher_selectBuildingDOM").value
  );
  _customscript_watcher_priorities.queue.push(
    document.querySelector("#_customscript_watcher_selectBuildingDOM").value
  );
  _customscript_watcher_cacheQueue();
  _customscript_watcher_updateDOM();
};

const _customscript_watcher_popFromQueueOnce = () => {
  console.log("REMOVING ", _customscript_watcher_priorities.queue[0]);
  _customscript_watcher_priorities.queue.shift();
  _customscript_watcher_cacheQueue();
  _customscript_watcher_updateDOM();
};

/**
 * Get next building to be built/upgraded,
 * save it in buffer and run the DOM triggers
 */
const _customscript_watcher_runScheduler = () => {
  if (!_customscript_watcher_nextBuildingBuffer)
    _customscript_watcher_nextBuildingBuffer =
      _customscript_watcher_getNextBuilding();

  if (
    !_customscript_watcher_nextBuildingBuffer ||
    document.querySelectorAll("#buildqueue tr").length == 4
  )
    return;

  const upgradeDOM = document.querySelector(
    `#${_customscript_watcher_nextBuildingBuffer.id} a.btn.btn-build`
  );

  if (upgradeDOM) {
    _customscript_watcher_nextBuildingBuffer = null;
    _customscript_watcher_cacheQueue();
    upgradeDOM.click();
  }
};

/**
 * Just switch the scheduler state, cleaning the next building
 * buffer and updating the static text manually
 */
const _customscript_watcher_toggleSchedulerONOFF = () => {
  _customscript_watcher_schedulerON = !_customscript_watcher_schedulerON;
  _customscript_watcher_nextBuildingBuffer = null;

  const toggleSchedulerButtonDOM = document.querySelector(
    "#_customscript_watcher_schedulerToggleButtonDOM"
  );

  toggleSchedulerButtonDOM.innerHTML = _customscript_watcher_schedulerON
    ? "ON"
    : "OFF";
};

const _customscript_watcher_cacheQueue = () => {
  let bufQueue = [..._customscript_watcher_priorities.queue];

  // Save with next building in case of leaving the page
  if (_customscript_watcher_nextBuildingBuffer)
    bufQueue = [_customscript_watcher_nextBuildingBuffer.id, ...bufQueue];

  window.localStorage.setItem("_customscript_watcher_queue", JSON.stringify());
};

/**
 * Start main functions of the script only if
 * in the main page
 *
 * Also initiate main functions
 */
if (location.search.includes("screen=main")) {
  _customscript_watcher_buildDOM();
  _customscript_watcher();
}
