// Hooks.on("updateActor", console.log)

const MODULE_ID = 'MadMechanicalEyes';
Hooks.once("ready", () => {
  if (!game.user.isGM)
    return;

  const charList = game.actors.filter(value => {
    return value.data.type === "character" && Object.keys(value.data.permission)
      .some((permLevel) => (permLevel !== 'default' && permLevel !== game.user.id) && value.data.permission[permLevel] > 0)
  }).reduce((acc, value) => {
    return {...acc, [value.data._id]: value.data.name}
  }, {default: 'none'});

  let playerData;
  game.settings.register(MODULE_ID, "PlayerWithMadMechanicalEyes", {
    name: 'Player with Mad Eyes',
    scope: 'world',
    config: 'true',
    type: String,
    choices: charList,
    default: 'none',
    onChange: value => playerData = getNewPlayerData(value)
  });

  game.settings.register(MODULE_ID, "MadMechanicalEyesDarkVision", {
    name: 'Dark Vision on Nat 20',
    hint: 'Always uses the greater on, either the token dimSight setting or the module dimSight setting => (token.dimSight > module.dimSight) ? token.dimSight : module.dimSight',
    scope: 'world',
    config: 'true',
    type: Number,
    default: '60',
    onChange: value => playerData = getNewPlayerData(value)
  });

  playerData = getNewPlayerData(game.settings.get(MODULE_ID, "PlayerWithMadMechanicalEyes"));


  Hooks.on("updateActor", (actor) => {
    if (actor.data._id === playerData.id) {
      if (playerData.hp <= actor.data.data.attributes.hp.value) {
        playerData.hp = actor.data.data.attributes.hp.value;
        return;
      }
      playerData.hp = actor.data.data.attributes.hp.value;
      reRollMadEyes(actor,"Schaden erhalten");
    }

  });

  Hooks.on("renderChatMessage", (message) => {
    if (Date.now() - message.data.timestamp > 2000)
      return;
    if (game.modules.get("betterrolls5e")?.active)
      return betterRolls(message, "Perception Check")

    if (message.data.flags.length === 0 || message.data.flags.dnd5e == null)
      return

    if (message.data.flags.dnd5e.roll.type === "skill" && message.data.flags.dnd5e.roll.skillId === "prc")
      reRollMadEyes(game.actors.get(playerData.id), "Perception Check")
  })

  function betterRolls(message) {
    if (message.data.content.includes("<h3 class=\"item-name\">Perception</h3>"))
      reRollMadEyes(game.actors.get(playerData.id), "Perception Check")
  }

  function reRollMadEyes(actor, context) {
    // Roll with flavor text
    let res = new Roll('1d20');
    res.toMessage({
      speaker: ChatMessage.getSpeaker({actor}),
      flavor: 'Mad Mechanical Eyes Roll ( '+ context + ' )',
      rollMode: 'gmroll'
    });

    let token = canvas.tokens.placeables.find(t => t.data.actorId === playerData.id);
    if (res.result === "1")
      token.update({
        vision: false,
        dimSight: 1,
        brightSight: 0,
        effects: token.data.effects.includes("icons/svg/blind.svg") ? token.data.effects : ["icons/svg/blind.svg", ...token.data.effects]
      })
    else if (res.result === "20") {
      let moduleDimSight = game.settings.get(MODULE_ID, "MadMechanicalEyesDarkVision");
      token.update({
        vision: true,
        dimSight: (actor.data.token.dimSight > moduleDimSight) ? actor.data.token.dimSight : moduleDimSight,
        brightSight: actor.data.token.brightSight,
        effects: token.data.effects.filter(v => v !== "icons/svg/blind.svg")
      });
    } else {
      token.update({
        vision: true,
        dimSight: actor.data.token.dimSight,
        brightSight: actor.data.token.brightSight,
        effects: token.data.effects.filter(v => v !== "icons/svg/blind.svg")
      });
    }
  }
})

function getNewPlayerData(id) {
  return {id: id, hp: game.actors.get(id).data.data.attributes.hp.value}
}