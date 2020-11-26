// const express = require('express')
// const app = express();
// app.disable('x-powered-by')

const Discord = require('discord.js')
const client = new Discord.Client()

const joinToCreateChannelID = '780570910171463680'
const token = process.env.TOKEN

let channelRooms = new Map()
let roleSetup = new Map()

const prefix = '!'

const offLimits = [ "ADMIN", "ADMINISTRATOR", "ADMINISTRAITOR", "MAXBOT", "INTERROGATION", "QUARANTINE" ]

client.once('ready', () => {
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
    const oldUserChannel = oldState.channel
    const newUserChannel = newState.channel

    // User joins a channel
    if (newUserChannel !== null) {

        const player = newState.member
        const guild = newState.guild
        const channel = newUserChannel

        // User join the 'Join to Create' channel
        if (channel.id == joinToCreateChannelID) {

            let newChannel = await guild.channels.create(player.displayName + "'s channel", { 
                type: 'voice', 
                parent: '627381429877211150',
                permissionOverwrites: [
                    {
                        id: player.id,
                        allow: ['MANAGE_CHANNELS']
                    },
                ]
            }).then(console.log("New room for: " + player.displayName + "(" + player.id + ")")).catch(console.error)

            player.voice.setChannel(newChannel.id)
            channelRooms.set(newChannel.id, [ player.id ])

        }
        
        if (channelRooms.has(channel.id)) { //User joins a channel room

            // If player isn't already in the room add them
            if (!channelRooms.get(channel.id).includes(player.id)) {
                channelRooms.get(channel.id).push(player.id)
                console.log("Added " + player.displayName + " to room " + channel.id)
            }

        }

    }

    // User leaves a channel
    if (oldUserChannel !== null) {

        const player = oldState.member
        const channel = oldUserChannel

        // Users leaves a channel room with more than 0 members - see if we can transfer ownership
        if (channelRooms.has(channel.id)) {
            // User leaves a channel room with 0 members - delete it
            if (channel.members.size == 0) {
                console.log("Deleted room " + channel.id)
                channelRooms.delete(channel.id)
                channel.delete()
            }

            const oldAdminID = channelRooms.get(channel.id)[0]

            const index = channelRooms.get(channel.id).indexOf(player.id)
            if (index > -1) {
                channelRooms.get(channel.id).splice(index, 1);
            }
            
            console.log(player.displayName + " left a room.")

            if (channelRooms.get(channel.id)[0] !== oldAdminID) {
                const newAdminID = channelRooms.get(channel.id)[0]
                const newAdmin = oldState.guild.members.cache.get(newAdminID)

                console.log("Because " + player.displayName + " left a room they owned, " + newAdmin.displayName + " will take over.")

                channel.permissionOverwrites.get(oldAdminID).delete();
                channel.overwritePermissions([
                    {
                        id: newAdminID,
                        allow: ['MANAGE_CHANNELS']
                    }
                ])
                channel.setName(newAdmin.displayName + "'s channel")
            }
        }

    }
})

client.login(token)

// app.get('/*', (req, res) => {
//     res.status(404).send('Beep boop.')
// })

// app.listen(8080, () => {
//     console.log('Health checks open on port 8080.');
// });