'use strict';

function formatFluidType(type) {
  const map = {
    water: 'Water',
    juice: 'Juice',
    vitamin_water: 'Vitamin Water',
    milk: 'Milk',
    pediasure: 'PediaSure',
    yogurt_drink: 'Yogurt Drink',
    urine: 'Urine',
    poop: 'Poop',
    vomit: 'Vomit',
  };
  return map[type] || type;
}

function formatPoopSubtype(subtype) {
  const map = {
    normal: 'Normal',
    diarrhea: 'Diarrhea',
    undigested: 'Undigested',
  };
  return map[subtype] || null;
}

module.exports = {
  formatFluidType,
  formatPoopSubtype,
};
