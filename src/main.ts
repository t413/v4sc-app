import m from "mithril";

import { Charger, charger } from "./charger";
import version from "./git-version.json";
import { Preset } from "./preset";
import { SelectInput } from "./select";
import { StatusTile } from "./status-tile";
import "./style.css";

(window as any).charger = charger;

const MainComponent: m.Component = {
  view() {
    const status = charger.currentStatus() ?? Charger.emptyStatus();
    const currentPreset = Preset.currentPreset;

    const soc = charger.getStateOfCharge();
    const goalSOC = charger.getSetpointSoc();
    const goalSOCShow = !goalSOC || goalSOC > 90 ? 90 : goalSOC;
    const timeEst = charger.getTimeEstimateSoc(goalSOCShow);
    const restCellV = charger.getRestCellV() ?? 0;
    const cellCount = charger.getCellCount() ?? 0;
    const capacityAh = charger.getCapacityAh();
    const socStr = ((soc ? soc.toFixed(1) : "0.0") + "%").split(".");
    if (!Preset.userPreset.isSet() && soc) {
      //first good charger data
      Preset.userPreset.soc = soc;
      Preset.userPreset.current = charger.setpoint.current;
      Preset.inferPreset();
      console.log("user preset set", Preset.userPreset, "current", Preset.currentPreset);
    }
    const allPresets = Preset.getAllPresets();
    console.log("render, currentPreset:", Preset.currentPreset);

    const cRating = capacityAh ? status.dcOutputCurrent / capacityAh : 0;
    const showCurrentSetpoint = !soc || status.dcOutputCurrent < 0.01;
    return [
      m("h2", [m(".val", [socStr[0], m("span.small", "." + socStr[1])])]),
      m("h3", [
        m(".val", timeEst ? Charger.timeStr(timeEst) : "∞"),
        m(".sub", [
          !charger.isConnected() ? "disconnected" :
          showCurrentSetpoint ? "idle" :
          "until " + goalSOCShow.toFixed(0) + "%"
        ]),
      ]),
      m("hr"),
      m(".status", [
        // Goal Charge Percentage
        m(StatusTile, {
          editableValue: (goalSOC ?? 0).toFixed(0),
          displayValue: (goalSOC ?? 0).toFixed(0) + "%",
          subscript: "setpoint. " + charger.setpoint.voltage.toFixed(1) + "V",
          onChange: (valueStr) => {
            console.log("set soc", valueStr);
            Preset.userPreset.setSoc(Number(valueStr));
            Preset.currentPreset = Preset.inferPreset();
          },
        }),
        // Output Current
        m(StatusTile, {
          editableValue: currentPreset.getCurrent().toFixed(1),
          displayValue: showCurrentSetpoint ?
              currentPreset.getCurrent().toFixed(1) + "A" :
              status.dcOutputCurrent.toFixed(1) + "A",
          subscript: showCurrentSetpoint ? "setpoint" :
            (status.dcOutputVoltage * status.dcOutputCurrent).toFixed(1) + "W",
          onChange: (valueStr) => {
            console.log("set current", valueStr);
            Preset.userPreset.setCurrent(Number(valueStr));
            Preset.currentPreset = Preset.inferPreset();
          },
        }),
        // C Rating
        m(StatusTile, {
          displayValue: cRating.toFixed(1) + "C",
          subscript: "C-rating of " + (capacityAh ?? 0).toFixed(1) + "Ah",
        }),
        // Resting Cell Voltage
        m(StatusTile, {
          displayValue: restCellV.toFixed(2) + "V",
          subscript: "rest v/cell " + cellCount + "S",
        }),
        // Temperature
        m(StatusTile, {
          displayValue: Math.max(status.temperature1, status.temperature2).toFixed(0) + "°c",
          subscript: [
            "AC ",
            status.acInputVoltage.toFixed(0),
            "V ",
            status.acInputCurrent.toFixed(1),
            "A",
          ],
        }),
        // Resting Pack Voltage
        m(StatusTile, {
          displayValue: (restCellV * cellCount).toFixed(1) + "V",
          subscript: "@ rest",
        }),
      ]),
      m("hr"),
      m(".input-group", [
        m("label", "Presets"),
        m(SelectInput, {
          className: "model-select",
          options: allPresets.map((m) => m.getDesc()),
          selected: Preset.currentPreset?.getDesc(),
          onChange: (index: number) => {
            if (index < 0) return;
            Preset.currentPreset = allPresets[index];
            Preset.currentPreset.sendOutput();
          },
        }),
      ]),
      m(".input-group", [
        m("label", "Model" + (charger.autoDetectedModel ? " (detected)" : "")),
        m(SelectInput, {
          className: "model-select",
          options: charger.modelsDB.models.map((m) => m.name),
          selected: charger.model?.name,
          onChange: (index: number) => {
            charger.model = index >= 0 ? charger.modelsDB.models[index] : undefined;
            charger.autoDetectedModel = false;
            Preset.currentPreset?.sendOutput();
          },
        }),
      ]),
      m(
        "button",
        {
          onclick: async () => {
            if (charger.isConnected()) {
              charger.disconnect();
            } else {
              try {
                charger.connect();
              } catch (err) {}
            }
          },
        },
        charger.isConnected() ? "Disconnect" : "Connect"
      ),
      navigator.bluetooth
        ? ""
        : m(
            "p",
            "Web Bluetooth not available, try Chrome or ",
            m(
              "a",
              { href: "https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055" },
              "Bluefy"
            )
          ),
      m("footer", [
        m("p", "Open source on ", m("a", { href: "http://github.com/notlion/v4sc-app" }, "github")),
        m(".sub", "Version ", version),
      ]),
    ];
  },
};

const init = async () => {
  const appElem = document.getElementById("app");
  m.mount(appElem!, MainComponent);
};
document.addEventListener("DOMContentLoaded", init);
