// const express = require('express')
// const app = express();
// app.disable('x-powered-by')

// const PORT = process.env.PORT || 8080

const Discord = require('discord.js')
const client = new Discord.Client()

const token = process.env.TOKEN

const prefix = '!'
const offLimits = [ "ADMIN", "ADMINISTRATOR", "ADMINISTRAITOR", "MAXBOT", "INTERROGATION", "QUARANTINE" ]

let channelConfig = new Map()
let privateChannels = new Map()
let roleSetup = new Map()

client.once('ready', () => {
    // Matches join to create channel ID with the parent category to create the private channel under
    channelConfig.set('780570910171463680', '627381429877211150')

	console.log('MaxBot connected and ready to go!')
})

client.on('message', async msg => {
    const author = msg.author
    const authorID = author.id
    const content = msg.content

    // Request sent in #commands
    if (msg.channel.id === '767194564565532682') {
        // A setup process is already registered
        if (roleSetup.get(authorID) !== undefined) {
            const timeDifference = Math.floor((Date.now() - roleSetup.get(authorID).startTime) / 1000)
            
            // 5 minutes since the first request
            if (timeDifference <= 300) {
                if (content.toUpperCase() == 'stop'.toUpperCase() || content.toUpperCase() == 'exit'.toUpperCase() || content.toUpperCase() == 'cancel'.toUpperCase()) {
                    roleSetup.delete(authorID)
                    msg.channel.send(author.toString() + " Gotcha, cancelled your setup. Come back soon!")
                } else if (roleSetup.get(authorID).stage == 1) {
                    if (offLimits.includes(content.toUpperCase())) {
                        msg.channel.send(author.toString() + " Hold your horses! That role is off limits. Try again with another name.")
                        return
                    }
                    roleSetup.get(authorID).name = content
                    roleSetup.get(authorID).stage = 2
                    msg.channel.send(author.toString() + " '" + content + '\', got it. What color would you like it to be?')
                } else if (roleSetup.get(authorID).stage == 2) {
                    if (Discord.Util.resolveColor(content.toUpperCase()).toString() == "NaN") {
                        msg.channel.send(author.toString() + " Invalid color. Try again!")
                        return
                    }
                    roleSetup.get(authorID).color = content
                    let newRole = await msg.channel.guild.roles.create({
                        data: {
                            name: roleSetup.get(authorID).name,
                            color: roleSetup.get(authorID).color.toUpperCase(),
                        }
                    }).then(console.log).catch(console.error);
                    // msg.member.roles.add(await msg.guild.roles.fetch(newRole).id)
                    msg.channel.send(author.toString() + ' Thanks! Creating role ' + roleSetup.get(authorID).name + ' with the color ' + roleSetup.get(authorID).color + ' now.')
                    roleSetup.delete(authorID)
                }
            } else {
                roleSetup.delete(authorID)
            }
        }
    
        // Someone ran ! prefix
        if (msg.content.startsWith(prefix)) {
            const args = msg.content.slice(prefix.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();
        
            // Someone ran !vanity and isn't registered
            if (command === 'vanity' && roleSetup.get(authorID) === undefined) {
                msg.channel.send(author.toString() + ' What do you want your vanity role to be named?')
                roleSetup.set(authorID, { 
                    startTime: Date.now(),
                    stage: 1
                })
            }
        }
    }
})

client.on('voiceStateUpdate', async (oldState, newState) => {
    const oldChannel = oldState.channel
    const newChannel = newState.channel

    // User joins a channel
    if (newChannel !== null) {

        const player = newState.member
        const guild = newState.guild
        const channel = newChannel

        // User joins the 'Join to Create' channel
        if (channelConfig.has(channel.id)) {

            // Generate a new private channel
            let privateChannel = await guild.channels.create(player.displayName + "'s channel", { 
                type: 'voice', 
                parent: channelConfig.get(channel.id),
                permissionOverwrites: [
                    {
                        id: player.id,
                        allow: ['MANAGE_CHANNELS']
                    },
                ]
            }).then(console.log(Date.now() + ": A new room was created for: " + player.displayName + "(" + player.id + ")")).catch(console.error)

            // Move the player to the privte channel and add it to database
            player.voice.setChannel(privateChannel.id)
            privateChannels.set(privateChannel.id, [ player.id ])
            console.log(privateChannels.get(privateChannel.id))

        }
        
        //User joins an existing room
        if (privateChannels.has(channel.id)) {

            // If player isn't already in the room add them
            if (!privateChannels.get(channel.id).includes(player.id)) {
                privateChannels.get(channel.id).push(player.id)
                console.log(Date.now() + ": Added " + player.displayName + " to room " + channel.id)
                console.log(privateChannels.get(channel.id))
            }

        }

    }

    // User leaves a channel - The old channel exists and either the new channel doesn't exist(they left) or the new channel is different(they switched channels)
    if (oldChannel !== null && (newChannel === null || oldChannel !== newChannel)) {

        const player = oldState.member
        const channel = oldChannel

        // User leaves a channel room with 0 members - delete it
        if (privateChannels.has(channel.id) && channel.members.size === 0) {
            console.log(Date.now() + "Deleted room " + channel.id + " due to " + player.displayName + " leaving")
            privateChannels.delete(channel.id)
            console.log(privateChannels.get(channel.id))
            channel.delete()
        }

        // User leaves a channel room with more than 0 members - see if we can transfer ownership
        if (privateChannels.has(channel.id)) {
            const oldAdminID = privateChannels.get(channel.id)[0]

            const index = privateChannels.get(channel.id).indexOf(player.id)
            if (index > -1) {
                privateChannels.get(channel.id).splice(index, 1);
            }
            
            console.log(player.displayName + " left a room")
            console.log(privateChannels.get(channel.id))

            const newAdminID = privateChannels.get(channel.id)[0]

            if (newAdminID !== oldAdminID) {
                const newAdmin = oldState.guild.members.cache.get(newAdminID)

                console.log("Because " + player.displayName + " left a room they owned, " + newAdmin.displayName + " will take over.")
                console.log(privateChannels.get(channel.id))

                channel.setName(newAdmin.displayName + "'s channel")
                channel.permissionOverwrites.get(oldAdminID).delete();
                channel.overwritePermissions([
                    {
                        id: newAdminID,
                        allow: ['MANAGE_CHANNELS']
                    }
                ])
            }
        }

    }
})

client.login(token)

// app.get('/*', (req, res) => {
//     res.status(404).send('Beep boop.')
// })

// app.listen(PORT, () => {
//     console.log('Health checks open on port ' + PORT + '.');
// });