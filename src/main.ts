import m from "mithril";

import { SelectInput } from "./select";
import { Charger } from "./charger";
import "./style.css";
import vers from "./git-version.json";

class Preset {
  name: string;
  soc: number;
  current: number;
  constructor(name: string, soc: number, current: number) {
    this.name = name;
    this.soc = soc;
    this.current = current;
  }
  getDesc(cellCount: number = 1) {
    if (this.soc === 0 || this.current === 0)
      return this.name;
    return [
      this.name,
      this.current + "A",
      this.soc + "%",
      (Charger.getVoltageForSoc(this.soc) * cellCount).toFixed(1) + "V",
    ].join(" ");
  }
}

const models: Preset[] = [
  new Preset("", 0, 0),
  new Preset("Off", 0, 0),
  new Preset("Max", 100, 18),
  new Preset("Casual", 90, 5),
  new Preset("Storage", 60, 3),
];

let currentModel: Preset | null = null;

const charger = new Charger();
(window as any).charger = charger;

const onChangeModel = async (model: Preset) => {
  currentModel = model;
  if (model.soc === 0 || model.current === 0) {
    charger.setOutputEnabled(false);
  } else {
    const vgoal = Charger.getVoltageForSoc(model.soc) * (charger.getCellCount() ?? 0);
    if (vgoal > 0) {
      await charger.setOutputEnabled(true);
      await charger.setOutputVoltage(vgoal);
      await charger.setOutputCurrent(model.current);
    }
  }
};

const MainComponent: m.Component = {
  view() {
    const s = charger.currentStatus() ?? Charger.emptyStatus();
    const soc = charger.getStateOfCharge();
    const goalSOC = charger.getSetpointSoc();
    const goalSOCShow = (!goalSOC || goalSOC > 90)? 90 : goalSOC;
    const timeEst = charger.getTimeEstimateSoc(goalSOCShow);
    const restCellV = charger.getRestCellV() ?? 0;
    const cellCount = charger.getCellCount() ?? 0;
    return [
      m(".status", [
        m("h2", [
          m(".val", (soc? soc.toFixed(1) : "NA") + "%" ),
        ]),
        m("h3", [
          m(".val", (timeEst? Charger.timeStr(timeEst) : "∞")),
          m(".sub", ["until " + goalSOCShow + "%"]),
        ]),
        m("h4", [
          m(".val", s.dcOutputCurrent.toFixed(1) + "A"),
          m(".val .sub", (s.dcOutputVoltage * s.dcOutputCurrent).toFixed(1) + "W"),
        ]),
        m("h4", [
          m(".val", (Math.max(s.temperature1, s.temperature2)).toFixed(0) + "ºC"),
          m(".val .sub", ("AC " + s.acInputVoltage.toFixed(0) + "V " + s.acInputCurrent.toFixed(1) + "A")),
          // also could add s.acInputFrequency
        ]),
        m("h4", [
          m(".val", (goalSOC ?? 0).toFixed(0) + "%"),
          m(".sub", "setpoint"),
        ]),
        m("h4", [
          m(".val", restCellV.toFixed(2) + "V"),
          m(".val .sub", (restCellV * cellCount).toFixed(1) + "V@rest " + cellCount + "S"),
        ]),

      ]),
      m(".input-group", [
        m("label", "Set Setpoint %"),
        m(NumberInput, {
          value: charger.getSetpointSoc() ?? 95,
          onChange: (soc: number) => {
            if (!cellCount) return;
            const vgoal = Charger.getVoltageForSoc(soc) * cellCount;
            charger.setOutputVoltage(vgoal);
            //update other number inputs
          },
        }),
      ]),
      m(".input-group", [
        m("label", "Set Voltage"),
          m(NumberInput, {
            value: charger.setpoint.voltage,
            onChange: (voltage: number) => {
              charger.setOutputVoltage(voltage);
            },
          }),
      ]),
      m(".input-group", [
        m("label", "Set  Current"),
          m(NumberInput, {
            value: charger.setpoint.current,
            onChange: (current: number) => {
              charger.setOutputCurrent(current);
            },
          }),
      ]),
      m(".input-group", [
        m("label", "Presets"),
          m(SelectInput, {
            className: "model-select",
            options: models.map((m) => m.getDesc(charger.getCellCount() ?? 1)),
            selected: currentModel?.getDesc(charger.getCellCount() ?? 1),
            onChange: (index: number) => {
              onChangeModel(models[index]);
            },
          }),
      ]),
      m("button.connect",
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
      navigator.bluetooth ? "" : (m("p", "Web Bluetooth not available, try Chrome or ", m("a", { href: "https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055" }, "Bluefy"))),
      m("footer", [
        m("p", "Open source on ", m("a", { href: "http://github.com/notlion/v4sc-app" }, "github")),
        m(".sub", "Version ", vers),
      ]),
    ];
  },
};

interface NumberInputAttrs {
  value: number;
  onChange: (value: number) => void;
}
const NumberInput: m.Component<NumberInputAttrs> = {
  view() {
    return m("input[type=number,inputmode=numeric]", { spellcheck: false });
  },
  oncreate(vnode) {
    const elem = vnode.dom;
    if (elem instanceof HTMLInputElement) {
      elem.value = vnode.attrs.value.toFixed(1);
      elem.addEventListener("blur", () => {
        vnode.attrs.onChange(Number(elem.value));
        m.redraw();
      });
      elem.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.code == "Enter") {
          event.preventDefault();
          elem.blur();
        }
      });
    }
  },
  onupdate(vnode) {
    const elem = vnode.dom;
    if (elem instanceof HTMLInputElement) {
      if (elem !== document.activeElement) {
        elem.value = vnode.attrs.value.toFixed(1);
      }
    }
  },
};

const init = async () => {
  const appElem = document.getElementById("app");
  m.mount(appElem!, MainComponent);
};
document.addEventListener("DOMContentLoaded", init);
