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
    let gmRoll;
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

    game.settings.register(MODULE_ID, "MadMechanicalEyesGmRoll", {
        name: 'Gm Roll',
        hint: 'Show roll as GM roll, disabling this will show no roll in chat',
        scope: 'world',
        config: 'true',
        type: Boolean,
        default: true,
        onChange: value => gmRoll = value
    });

    playerData = getNewPlayerData(game.settings.get(MODULE_ID, "PlayerWithMadMechanicalEyes"));
    gmRoll = game.settings.get(MODULE_ID, "MadMechanicalEyesGmRoll")

    Hooks.on("updateActor", (actor) => {
        if (actor.data._id === playerData.id) {
            if (playerData.hp <= actor.data.data.attributes.hp.value) {
                playerData.hp = actor.data.data.attributes.hp.value;
                return;
            }
            playerData.hp = actor.data.data.attributes.hp.value;
            reRollMadEyes(actor, "Schaden erhalten");
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
        let parsed = new DOMParser().parseFromString(message.data.content, 'text/html')
        let messageContent = parsed.getElementsByClassName("item-name")[0]?.textContent;
        if (messageContent == null)
            return;
        if (messageContent.trim() === "Perception") {
            Array.from(parsed.getElementsByClassName("dice-total dice-row-item red-base-die")).forEach(value => {
                if (!value.classList.contains("ignored")) {
                    let diceFormula = parsed.getElementsByClassName("dice-formula dice-tooltip")[0].textContent.trim();
                    let roll;
                    let plusIndex = diceFormula.indexOf("+")
                    let minusIndex = diceFormula.indexOf("-")
                    if (plusIndex < minusIndex || plusIndex > -1 &&  minusIndex === -1) {
                        roll = diceFormula.split(" + ").slice(1).reduce(
                          (acc, val) => {
                              return acc + parseInt(val.split(" - ")[0]) - val.split(" - ").slice(1)
                                .reduce((acc2, val2) => acc2 - parseInt(val2), 0)
                          }, 0)
                    } else {
                        roll = diceFormula.split(" - ").slice(1)
                          .reduce((acc, val) => {
                              return (acc - val.split(" + ")[0]) + val.split(" + ").slice(1)
                                .reduce((acc2, val2) => acc2 + val2, 0)
                          }, 0)
                    }

                    applyMadEyesUpdateActor(game.actors.get(playerData.id), (parseInt(value.textContent) - roll).toString());
                }
            })
        }
    }

    function reRollMadEyes(actor, context) {
        let res = new Roll('1d20').roll();
        if (gmRoll)
            res.toMessage({
                speaker: ChatMessage.getSpeaker({actor}),
                flavor: 'Mad Mechanical Eyes Roll ( ' + context + ' )',
                rollMode: 'gmroll'
            });

        applyMadEyesUpdateActor(actor, res.result)

    }

    function applyMadEyesUpdateActor(actor, result) {
        game.scenes.entities.flatMap(scene => {
            scene.data.tokens = scene.data.tokens.filter(token => token.actorId === playerData.id)
            return scene
        }).forEach(scene => {
            scene.data.tokens.map(token => new Token(token, scene)).forEach(token => {
                if (result === "1")
                    token.update({
                        vision: false,
                        dimSight: 1,
                        brightSight: 0,
                        effects: token.data.effects.includes("icons/svg/blind.svg") ? token.data.effects : ["icons/svg/blind.svg", ...token.data.effects]
                    })
                else if (result === "20") {
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
            })
        })
    }
})

function getNewPlayerData(id) {
    return {id: id, hp: game.actors.get(id).data.data.attributes.hp.value}
}