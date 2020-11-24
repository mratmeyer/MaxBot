const express = require('express')
const app = express();
app.disable('x-powered-by')

const Discord = require('discord.js')
const client = new Discord.Client()

const joinToCreateChannelID = '780570910171463680'
const token = process.env.TOKEN

let channelRooms = new Map()

client.once('ready', () => {
	console.log('MaxBot connected and ready to go!')
})


client.on('message', msg => {
    if (msg.content.toUpperCase() === 'Poggers'.toUpperCase()) {
        msg.channel.send('Poggers!');
    }
});

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

        } else if (channelRooms.has(channel.id)) { //User joins a channel room

            channelRooms.get(channel.id).push(player.id)
            console.log("Added " + player.displayName + " to room " + channel.id)

        }

    }

    // User leaves a channel
    if (oldUserChannel !== null) {

        const player = oldState.member
        const channel = oldUserChannel

        // User leaves a channel room with 0 members - delete it
        if (channelRooms.has(channel.id) && channel.members.size == 0) {
            console.log("Deleted room " + channel.id)
            channelRooms.delete(channel.id)
            channel.delete()
        }

        // Users leaves a channel room with more than 0 members - see if we can transfer ownership
        if (channelRooms.has(channel.id)) {
            const oldAdminID = channelRooms.get(channel.id)[0]

            const index = channelRooms.get(channel.id).indexOf(player.id)
            if (index > -1) {
                channelRooms.get(channel.id).splice(index, 1);
            }
            
            console.log(player.displayName + " left a room.")

            if (channelRooms.get(channel.id)[0] !== oldAdminID) {
                const newAdminID = channelRooms.get(channel.id)[0]
                const newAdmin = oldState.guild.members.cache.get(newAdminID);

                console.log("Because " + player.displayaName + " left a room they owned, " + newAdminID.displayName + " will take over.")

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

app.get('/*', (req, res) => {
    res.status(404).send('Beep boop.')
})

app.listen(8080, () => {
    console.log('Health checks open on port 8080.');
});