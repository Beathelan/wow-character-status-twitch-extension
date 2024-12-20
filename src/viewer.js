let token, userId;
let isListening = false;
let lastCharacterStatus;

// so we don't have to write this out everytime 
const twitch = window.Twitch.ext;
const EQUIPMENT_SLOT_PLACEHOLDERS = [
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_head.jpg',
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_neck.jpg',
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_shoulder.jpg',
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_chest.jpg', // cloak
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_chest.jpg', // chest
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_shirt.jpg',
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_tabard.jpg',
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_wrists.jpg',
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_hands.jpg',
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_waist.jpg',
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_legs.jpg',
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_feet.jpg',
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_finger.jpg', // finger slot 0
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_finger.jpg', // finger slot 1
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_trinket.jpg', // trinket slot 0
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_trinket.jpg', // trinket slot 1
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_mainhand.jpg', 
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_offhand.jpg',
  'https://wow.zamimg.com/images/wow/icons/large/inventoryslot_ranged.jpg', // TODO: replace with relic for Paladin, Shaman, Druid
];

const BG_COLORS_PER_POWER_TYPE = {
  hp: '#007300',
  mana: '#0000FF',
  energy: '#C7A914',
  rage: '#FF0000',
  focus: '#FF8040',
}

const CSS_CLASS_RIP_FILTER = 'rip-filter';

let getBgGradientForPowerType = (powerType, percent) => {
  let bgColor = BG_COLORS_PER_POWER_TYPE[powerType] || BG_COLORS_PER_POWER_TYPE.hp;
  return `linear-gradient(to right, ${bgColor} ${percent}%, rgba(255,0,0,0) ${percent}%, rgba(255,0,0,0) 100%)`
};

let refreshCharacterNameplate = (characterStatus) => {
  if (!characterStatus) {
    // Don't do anything if there is no characterStatus
    return;
  }

  const level = characterStatus?.Level;
  const characterClass = characterStatus?.Class?.Name;
  const race = characterStatus?.Race?.Name;
  let nameplate = 'Adventurer of Azeroth';
  if (!!level && !!characterClass && !!race) {
    nameplate = `Level ${level} ${race} ${characterClass}`;
  }
  document.getElementById("charBasicData").textContent = nameplate;
};

let refreshCharacterResources = (characterStatus) => {
  if (!characterStatus) {
    // Don't do anything if there is no characterStatus
    return;
  }

  if (!characterStatus?.HitPoints || !characterStatus?.Power) {
    document.getElementById("charUnitFrame").classList.add(CLASS_HIDDEN);
    return;
  }

  // HP
  let hpCurrent = 0, hpMax = 0, powerCurrent = 0, powerMax = 0;
  if (characterStatus?.HitPoints && characterStatus?.Power?.length > 0) {
    hpCurrent = characterStatus?.HitPoints?.Current || 0;
    hpMax = characterStatus?.HitPoints?.Max || 0;
  }
  hpCurrent = characterStatus?.HitPoints?.Current || hpCurrent;
  let hpPercent = hpMax !== 0 ? hpCurrent / hpMax * 100 : 100;
  let hpDisplay = `${hpCurrent}/${hpMax} (${hpPercent.toFixed()}%)`;
  document.getElementById("charHP").textContent = hpDisplay;
  document.getElementById("charHpBar").style['background'] = getBgGradientForPowerType('hp', hpPercent);

  // Power (Mana, Energy, Rage, or Focus)
  let powerTypeName = 'Mana';
  if (characterStatus.Power?.length > 0) {
    powerCurrent = characterStatus.Power[0]?.Current || powerCurrent;
    powerMax = characterStatus.Power[0]?.Max || powerMax;
    powerTypeName = characterStatus.Power[0]?.Name || powerTypeName;
  }
  let powerPercent = powerMax !== 0 ? powerCurrent / powerMax * 100 : 100;
  let powerDisplay = `${powerCurrent}/${powerMax} (${powerPercent.toFixed()}%)`;
  document.getElementById("charPower").textContent = powerDisplay;
  document.getElementById("charPowerBar").style['background'] = getBgGradientForPowerType(powerTypeName.toLowerCase(), powerPercent);

  // Class icon
  let characterClass = characterStatus?.Class?.Name;
  let lastCharacterClass = lastCharacterStatus?.Class?.Name;
  let frameHiddenLastTime = !lastCharacterStatus?.HitPoints || !lastCharacterStatus?.Power;
  if (lastCharacterClass !== characterClass || frameHiddenLastTime) {
    document.getElementById("charClassIcon").innerHTML = `<ins style="background-image: url('https://wow.zamimg.com/images/wow/icons/large/class_${characterClass.toLowerCase()}.jpg')"></ins>`;
  }
  document.getElementById("charUnitFrame").classList.remove(CLASS_HIDDEN);
};

let getEquippedItemKey = (equippedItem) => {
  if (!equippedItem?.ItemId) {
    return undefined;
  }
  return `${equippedItem.ItemId}&ench=${equippedItem.EnchantId || ''}&rand=${equippedItem.SuffixId || ''}`;
}

let refreshCharacterEquipment = (characterStatus) => {
  const equipmentDiv = document.getElementById('equipment');
  const equipment = characterStatus?.EquippedItems;
  if (!equipment) {
    equipmentDiv.classList.add(CLASS_HIDDEN);
    return;
  }

  equipmentDiv.classList.remove(CLASS_HIDDEN);
  for (let i = 0; i < SUPPORTED_EQUIPMENT_SLOTS; i++) {
    const equippedItem = equipment[i];
    lastItemKey = getEquippedItemKey(lastCharacterStatus?.EquippedItems ? lastCharacterStatus?.EquippedItems[i] : undefined);
    currentItemKey = getEquippedItemKey(equippedItem);
    if (!!lastCharacterStatus && lastItemKey === currentItemKey) {
      // If there is no change from last snapshot, ignore
      continue;
    }
    const slotDiv = document.getElementById(`equipmentSlot-${i}`);
    slotDiv.classList.remove.apply(slotDiv.classList, Array.from(slotDiv.classList).filter(v=>v.startsWith('item-rarity-')));
    if (!equippedItem) {
      // If there is no item, show an empty slot
      slotDiv.innerHTML = `<ins style="background-image: url('${EQUIPMENT_SLOT_PLACEHOLDERS[i]}')"></ins>`;
    } else {
      let whData = '';
      if (equippedItem.EnchantId >= 0) {
        whData += `&ench=${equippedItem.EnchantId}`;
      }
      if (equippedItem.SuffixId >= 0) {
        whData += `&rand=${equippedItem.SuffixId}`;
      }
      slotDiv.classList.add(`item-rarity-${equippedItem.WowheadQualityId || 0}`);
      slotDiv.innerHTML = `<ins style="background-image: url('${equippedItem.WowheadIconUrl}')"></ins>` 
        + `<a href="${equippedItem.WowheadItemUrl}" target="_blank" ${ whData ? 'data-wowhead="' + whData + '"' : ''}></a>`;
    }
  }
};

let getWowheadTalentCalcUrl = (characterStatus) => {
  if (!characterStatus?.Class?.Name) {
    // Class name is required to build wowhead URL
    console.warn('Class name missing');
    return null;
  }
  if (!characterStatus?.Talents?.ExportString) {
    // Talents ExportString is required to build wowhead URL
    console.warn('ExportString missing');
    return null;
  }
  return `https://www.wowhead.com/classic/talent-calc/${characterStatus.Class.Name.toLowerCase()}/${characterStatus.Talents.ExportString}`;
};

let refreshWowheadTalentCalc = (characterStatus) => {
  const btnTalents = document.getElementById('btnTalents');
  const wowheadTalentCalcUrl = getWowheadTalentCalcUrl(characterStatus);
  if (!wowheadTalentCalcUrl) {
    btnTalents.classList.add(CLASS_HIDDEN);
  } else {
    btnTalents.classList.remove(CLASS_HIDDEN);
    btnTalents.href = wowheadTalentCalcUrl;
  }
};

let refreshCharacterGold = (characterStatus) => {
  if (!characterStatus) {
    // Don't do anything if there is no characterStatus
    return;
  }

  if (characterStatus.Gold !== lastCharacterStatus?.Gold) {
    let money = characterStatus.Gold || 0;
    let gold = Math.floor(money / 10000);
    money = money - gold * 10000;
    let silver = Math.floor(money / 100);
    money = money - silver * 100;
    let copper = money;
    document.getElementById("charGold").innerHTML = `${gold.toFixed()}<span class="money gold"></span> ${silver.toFixed()}<span class="money silver"></span> ${copper.toFixed()}<span class="money copper"></span>`;
  }

  if (characterStatus.Gold == null) {
    document.getElementById("charGoldWrapper").classList.add(CLASS_HIDDEN);
  } else {
    document.getElementById("charGoldWrapper").classList.remove(CLASS_HIDDEN);
  }
};

let refreshDeadOrGhost = (characterStatus) => {
  if (characterStatus?.DeadOrGhost) {
    document.documentElement.classList.add(CSS_CLASS_RIP_FILTER);
  } else {
    document.documentElement.classList.remove(CSS_CLASS_RIP_FILTER);
  }
}

let refreshCharacterStatus = (characterStatus) => {
  refreshCharacterNameplate(characterStatus);
  refreshCharacterResources(characterStatus);
  refreshCharacterEquipment(characterStatus);
  refreshWowheadTalentCalc(characterStatus);
  refreshDeadOrGhost(characterStatus);
  refreshCharacterGold(characterStatus);

  const mainUnitDataDiv = document.getElementById('mainUnitData');
  const noDataPlaceholderDiv = document.getElementById('noDataPlaceholder');
  if (characterStatus) {
    mainUnitDataDiv.classList.remove(CLASS_HIDDEN);
    noDataPlaceholderDiv.classList.add(CLASS_HIDDEN);
  } else {
    mainUnitDataDiv.classList.add(CLASS_HIDDEN);
    noDataPlaceholderDiv.classList.remove(CLASS_HIDDEN);
  }
  lastCharacterStatus = characterStatus || undefined;
}

// callback called when context of an extension is fired 
twitch.onContext((context) => {
  console.log(`onContext fired with: ${JSON.stringify(context)}`);
});


// onAuthorized callback called each time JWT is fired
twitch.onAuthorized((auth) => {
  // save our credentials
  console.log(`onAuthorized fired for user: ${auth.userId}`);
  token = auth.token;  
  userId = auth.userId; 
  if (!isListening) {
    twitch.listen('broadcast', (target, contentType, message) => {
      // Uncomment to debug comms issues
      //console.log(`PubSub message recieved with target: ${target}, contentType: ${contentType} and message: ${message}`);
      let jsonMessage = JSON.parse(message);
      if (jsonMessage[PUB_SUB_WRAPPER_COMMAND] === PUB_SUB_COMMAND_CLEAR_CHARACTER_DATA) {
        refreshCharacterStatus(null);
      } else {
        refreshCharacterStatus(jsonMessage?.CharacterStatus);
      }
    });
    isListening = true;
  }
  console.log('Now listening for broadcast messages');
});

twitch.configuration.onChanged(function() {
  // Checks if configuration is defined
  if (twitch.configuration.broadcaster) {
    try {
      // Parsing the array saved in broadcaster content
      var config = JSON.parse(twitch.configuration.broadcaster.content);
      
      // Checking the content is an object
      if (typeof config === 'object') {
        // Updating the value of the options array to be the content from config
        options = config;
      } else {
        console.error('Broadcaster config is invalid (not an object)');
      }
    } catch (e) {
      console.error('Broadcaster config is invalid with exception)', e);
    }
  } else {
    console.info('Broadcaster config not defined');
  }
});