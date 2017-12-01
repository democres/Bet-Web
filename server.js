var __WebSocketServer	= require('websocket').server;
var __DATABASE          = require('mysql-json');
var __HTTPS				= require('https');
var __FILESYSTEM		= require('fs');

var __SHA1              = require('sha1');
var __SHA256            = require('sha256');

var __SSL_PKEY			= __FILESYSTEM.readFileSync('/etc/letsencrypt/live/betting.reddev2.com/privkey.pem');
var __SSL_CERT			= __FILESYSTEM.readFileSync('/etc/letsencrypt/live/betting.reddev2.com/cert.pem')

var options = {
    key: __SSL_PKEY,
    cert: __SSL_CERT
};

var HTTPSServer = __HTTPS.createServer(options, function(request, response) {

    response.writeHead(404);
    response.end();
});
 
var WSSServer = new __WebSocketServer({httpServer: HTTPSServer, autoAcceptConnections: false});
var DB = __DATABASE({host: 'localhost', user: 'betting', password: 'betting', database: 'betting'});

var __Ticks = 2;
var __COMMISSION = 0.05;

var EVENTLIST = [];
var __EV_ID = 0;

WSSServer.on('request', function(request) {

    if (!originIsAllowed(request.origin)) {request.reject(); return;}
    
    var client = request.accept('gameserver', request.origin);
    var addr = client.remoteAddress;
    var __token = decodeURIComponent(request.resourceURL.path.substr(1, request.resourceURL.path.length - 1));
    
    client.Send = (data) => client.send(JSON.stringify(data))
    client.BalanceUpdate = () => client.Send({
        type: "balance_update",
        data: {
            balance: client.__Betting.user.balance
        }
    });


    client.EventListUpdate = () => (client.Send(client.getEventList()))
    client.getEventList = () => ({
        
        type: "event_list",
        data: {
            open: {
                incoming: EVENTLIST.filter((e) => (!e.status.started)),
                ongoing: EVENTLIST.filter((e) => (e.status.started && !e.status.ended)),
            },
            over: EVENTLIST.filter((e) => (
                    e.status.ended
                    && e.results.length == 0
                    && (
                            e.bets.filter((b) => (b.user_id == client.__Betting.user.id)).length > 0
                        || client.__Betting.user.account_type == 'ADMIN'
                    )
                )
            )
        }
    })

	client.__Betting = {
        
        connection: {

            IPv4: addr.substr(7, addr.length - 7),
            token: __token.substr(1, __token.length - 2)
        },
        
        user: null
	};
	
	DB.query("SELECT * FROM `active_tokens` WHERE `token` = '" + client.__Betting.connection.token + "'", (err, res) => {

        if (res.length != 1) {

            client.Send({
                type: "disconnect",
                data: {
                    reason: "invalid_token"
                }
            });
            client.close();
        }

        else {

            client.__Betting.user = {
                
                'id': null,
                'username': null,
                'email': null,
                'balance': null,
                'account_type': null,
                'subscribed_to': {
                    'now': null,
                    'notifications': []
                }
            }

            DB.query("SELECT * FROM `users` WHERE `id` = " + res[0]._uid, (err, res) => {

                if (res.length != 1) {

                    client.Send({
                        type: "disconnect",
                        data: {
                            reason: "invalid_user"
                        }
                    });
                    client.close();
                } else {
                    
                    client.__Betting.user = {

                        'id': res[0].id,
                        'username': res[0].username,
                        'email': res[0].email,
                        'balance': res[0].balance,
                        'account_type': res[0].account_type,
                        'subscribed_to': {
                            'now': 0,
                            'notifications': []
                        }
                    }
                    
                    client.BalanceUpdate();
                    client.EventListUpdate();

                    console.log((new Date()), 'NEW', client.__Betting.connection.IPv4, client.__Betting.user.email);
                    
                    WSSServer.connections.filter((c) => (c.__Betting.user.id == client.__Betting.user.id && c !== client)).forEach((c) => {
                        
                        console.log((new Date()), 'DUPLICATE', c.__Betting.connection.IPv4, c.__Betting.user.email);
                        c.Send({
                            type: "disconnect",
                            data: {
                                reason: "duplicate"
                            }
                        });
                        c.close();
                    });
                }
            });
        }
    });

	client.on('message', function(msg) {
	
		if (msg.type === 'utf8') {
		
			// console.log((new Date()), 'INCOMING', msg.utf8Data);
            var _tmp = JSON.parse(msg.utf8Data);
            var type = _tmp.type;
            var data = _tmp.data
            
            if (type == 'keep_alive') client.Send({type: 'keep_alive'});

            if (type == 'transfer') {

                let to = data.to;
                let amount = data.amount;
                let pw = data.password;

                if (amount > 0) {

                    if (amount <= client.__Betting.user.balance) {
                    
                        if (to != client.__Betting.user.username) {
                            DB.query('SELECT * FROM `users` WHERE `id` = ' + client.__Betting.user.id, function(err, user) {

                                if (__SHA256(__SHA1(pw)) == user[0].password) {

                                    DB.query('SELECT * FROM `users` WHERE `username` = "' + to + '"', function(err, user_to) {

                                        if (user_to.length == 1) {
                                            
                                            let _tmpTr = {
                                                
                                                transfer_date: parseInt((new Date()).getTime() / 1000),
                                                from_uid: client.__Betting.user.id,
                                                to_uid: user_to[0].id,
                                                amount: amount
                                            }
                        
                                            DB.insert('transfers', _tmpTr, function(err, res) {

                                                DB.update('users',
                                                    {balance: (client.__Betting.user.balance - amount)},
                                                    {id: {operator: '=', value: client.__Betting.user.id}},
                                                    function(err, res) {
                                                        
                                                        DB.update('users', 
                                                            {balance: (user_to[0].balance + amount)},
                                                            {id: {operator: '=', value: user_to[0].id}},
                                                            function(err, res) {

                                                                let client_to = WSSServer.connections.findIndex((c) => (c.__Betting.user.id == user_to[0].id));
                                                                if (client_to >= 0) {

                                                                    WSSServer.connections[client_to].__Betting.user.balance += amount;
                                                                    WSSServer.connections[client_to].BalanceUpdate();
                                                                }

                                                                client.__Betting.user.balance -= amount;
                                                                client.Send({type: 'transfer_accepted'});
                                                                client.BalanceUpdate();
                                                            }
                                                        );
                                                    }
                                                );
                                            });
                                        } else
                                            client.Send({
                                                type: 'transfer_rejected',
                                                data: {
                                                    reason: 'username_notfound'
                                                }
                                            })
                                    });
                                } else
                                    client.Send({
                                        type: 'transfer_rejected',
                                        data: {
                                            reason: 'invalid_password'
                                        }
                                    })
                            });
                        } else
                            client.Send({
                                type: 'transfer_rejected',
                                data: {
                                    reason: 'its_yourself'
                                }
                            })

                    } else
                        client.Send({
                            type: 'transfer_rejected',
                            data: {
                                reason: 'balance_too_low'
                            }
                        })
                } else
                    client.Send({
                        type: 'transfer_rejected',
                        data: {
                            reason: 'illegal_operation'
                        }
                    })
            }
            
            if (type == 'unsubsribe_event') client.__Betting.user.subscribed_to.now = 0;
            if (type == 'subsribe_event') {

                client.__Betting.user.subscribed_to.now = data.id;
                client.Send({
                    type: 'subscription',
                    data: formatEvent(EVENTLIST.filter((e) => (e.id == client.__Betting.user.subscribed_to.now))[0], client)
                });
            }

            if (type == 'add_event' && client.__Betting.user.account_type == 'ADMIN') {
                
                var now = new Date();
                var start = new Date(now.getTime() + (data.date.start * 1000));
                var end = new Date(now.getTime() + (data.date.end * 1000));
                var bcd = new Date(start.getTime() + (data.date.bcd * 60 * 1000));
                
                if (bcd > end) bcd = end;

                let _tmpEv = {

                    name: data.name,
                    start_date: parseInt(start.getTime() / 1000),
                    end_date: parseInt(end.getTime() / 1000),
                    bcd: parseInt(data.date.bcd),
                }

                DB.insert('events', _tmpEv, function(err, event) {
                    
                        if (!err) {
                            
                            _tmpEv.id = event.insertId;
                            for (let i = 0 ; i < data.candidates.length ; i++) {
                                
                                DB.insert('candidates', {_eid: _tmpEv.id, name: data.candidates[i]}, function(err, candidate) {
                                    
                                    if (i == data.candidates.length - 1) {
                                        
                                        LoadEventFromDB(_tmpEv, now, BroadcastEventList);
                                    }
                                })
                            }
                        }
                    }
                );
            }

            if (type == 'update_results' && client.__Betting.user.account_type == 'ADMIN') {

                if (data.results.length > 0) {

                    let index = EVENTLIST.findIndex((e) => e.id == data.id);
                    if (index >= 0) {
                        
                        if (data.results.length <= EVENTLIST[index].candidates.length) {

                            // add results
                            // update database
                            for (let i = 0 ; i < data.results.length ; i++) {
                                
                                EVENTLIST[index].results.push(data.results[i]);
                                DB.insert('results', {_eid: EVENTLIST[index].id, _cid: data.results[i]}, function(err, result) {

                                    if (i == data.results.length - 1) {

                                        // caculate outcomes
                                        // CalculateRiskAndEarning();
                                        for (let j = 0 ; j < EVENTLIST[index].bets.length ; j++) {
                                            
                                            EVENTLIST[index].bets[j].to_grant = EVENTLIST[index].bets[j].safe;
                                            if (EVENTLIST[index].bets[j].candidate_id == data.results[0])    // DATA.RESULTS[0] => ONLY FIRST RESULT
                                                EVENTLIST[index].bets[j].to_grant += EVENTLIST[index].bets[j].earning;

                                            GrantWinnerMoney(EVENTLIST[index].bets[j].user_id, EVENTLIST[index].bets[j].to_grant)
                                        }

                                        // broadcast balances
                                        BroadcastAffectedBalance(EVENTLIST[index]);

                                        // unsubscribe users
                                        UnsubscribeUsers(EVENTLIST[index]);
                                        
                                        // remove event
                                        EVENTLIST.splice(index, 1);
            
                                        // broadcast eventlist
                                        BroadcastEventList();
                                    }
                                })
                            }
                        }
                    }
                }
            }

            if (type == 'bet') {

                let index = EVENTLIST.findIndex((e) => e.id == data.id);
                if (index >= 0) {

                    if (EVENTLIST[index].candidates.filter((c) => c.id == data.candidate).length == 1) {

                        if (!EVENTLIST[index].status.ended) {

                            if (EVENTLIST[index].bets.filter((b) => (b.user_id == client.__Betting.user.id && b.candidate_id == data.candidate)).length == 0) {

                                if (client.__Betting.user.balance >= data.amount && data.amount > 0) {

                                    DB.update('users', 
                                        {balance: (client.__Betting.user.balance - data.amount)},
                                        {id: {operator: '=', value: client.__Betting.user.id}},
                                        function(err, res) {

                                            // if (!err) {

                                            NewBet(index, client.__Betting.user.id, data.amount, data.candidate, client.__Betting.user.username);
                                            client.__Betting.user.balance -= data.amount;
                                            client.Send({type: 'bet_accepted', data: {action: 'place_bet'}});
                                            client.BalanceUpdate();
                                            // }
                                        }
                                    );
                                } else
                                    client.Send({
                                        type: 'bet_rejected',
                                        data: {
                                            action: 'bet',
                                            reason: 'balance_too_low'
                                        }
                                    })
                            } else
                                client.Send({
                                    type: 'bet_rejected',
                                    data: {
                                        action: 'bet',
                                        reason: 'already_bet_on_candidate'
                                    }
                                })
                        } else
                            client.Send({
                                type: 'bet_rejected',
                                data: {
                                    action: 'bet',
                                    reason: 'event_over'
                                }
                            })
                    } else
                        client.Send({
                            type: 'bet_rejected',
                            data: {
                                action: 'bet',
                                reason: 'candidate_notfound'
                            }
                        })
                } else
                    client.Send({
                        type: 'bet_rejected',
                        data: {
                            action: 'bet',
                            reason: 'event_notfound'
                        }
                    })
            }

            if (type == 'modify_bet') {

                let index = EVENTLIST.findIndex((e) => e.id == data.event);
                if (index >= 0) {

                    if (EVENTLIST[index].candidates.filter((c) => c.id == data.candidate).length == 1) {

                        let index_bet = EVENTLIST[index].bets.findIndex((e) => e.id == data.id);
                        if (index_bet >= 0) {
                            
                            if (EVENTLIST[index].bets[index_bet].candidate_id == data.candidate && EVENTLIST[index].bets[index_bet].user_id == client.__Betting.user.id) {

                                if (!EVENTLIST[index].status.ended) {
                                    
                                    let diff = data.amount - EVENTLIST[index].bets[index_bet].bet;
                                    if (data.amount >= 0 || diff < 0) {

                                        if (EVENTLIST[index].status.open) {

                                            if (data.amount == 0) {
                                                
                                                DB.update('users',
                                                    {balance: (client.__Betting.user.balance + EVENTLIST[index].bets[index_bet].bet)},
                                                    {id: {operator: '=', value: client.__Betting.user.id}},
                                                    function(err, res) {
                                                        
                                                        DB.delete('bets', {id: {operator: '=', value: data.id}}, function(err, res) {

                                                            client.__Betting.user.balance += EVENTLIST[index].bets[index_bet].bet;

                                                            let temp_bet_list = EVENTLIST[index].bets.slice();
                                                            temp_bet_list.splice(index_bet, 1);

                                                            EVENTLIST[index].bets = [];
                                                            EVENTLIST[index].biggestRisk = 0;

                                                            for (var i = 0 ; i < temp_bet_list.length ; i++)
                                                                NewBet(index, temp_bet_list[i].user_id, temp_bet_list[i].bet, temp_bet_list[i].candidate_id, temp_bet_list[i].username, temp_bet_list[i].id);

                                                            BroadcastSubscription(EVENTLIST[index]);
                                                            client.Send({type: 'bet_accepted', data: {action: 'remove_bet'}});
                                                            client.BalanceUpdate();
                                                        });
                                                    }
                                                );
                                            }

                                            else {

                                                DB.update('users',
                                                    {balance: (client.__Betting.user.balance - diff)},
                                                    {id: {operator: '=', value: client.__Betting.user.id}},
                                                    function(err, res) {
            
                                                        DB.update('bets',
                                                            {amount: data.amount},
                                                            {id: {operator: '=', value: data.id}},
                                                            function(err, res) {
                
                                                                client.__Betting.user.balance -= diff;
                                                                EVENTLIST[index].bets[index_bet].bet += diff;
                                                                EVENTLIST[index].biggestRisk = Math.max(EVENTLIST[index].biggestRisk, Math.min(data.amount, BiggestBetExcluding(index, data.candidate)));
                                                                CalculateRiskAndEarning(index);
                                                                BroadcastSubscription(EVENTLIST[index]);
                                                                client.Send({type: 'bet_accepted', data: {action: 'lower_bet'}});
                                                                client.BalanceUpdate();
                                                            }
                                                        );
                                                    }
                                                );
                                            }
                                        } else
                                            client.Send({
                                                type: 'bet_rejected',
                                                data: {
                                                    action: 'modify',
                                                    reason: 'event_closed'
                                                }
                                            })
                                    } else if (diff > 0) {
                                        
                                        if (diff <= client.__Betting.user.balance) {
                                            
                                            DB.update('users',
                                                {balance: (client.__Betting.user.balance - diff)},
                                                {id: {operator: '=', value: client.__Betting.user.id}},
                                                function(err, res) {
        
                                                    DB.update('bets',
                                                        {amount: data.amount},
                                                        {id: {operator: '=', value: data.id}},
                                                        function(err, res) {

                                                            client.__Betting.user.balance -= diff;
                                                            EVENTLIST[index].bets[index_bet].bet += diff;
                                                            EVENTLIST[index].biggestRisk = Math.max(EVENTLIST[index].biggestRisk, Math.min(data.amount, BiggestBetExcluding(index, data.candidate)));
                                                            CalculateRiskAndEarning(index);
                                                            BroadcastSubscription(EVENTLIST[index]);
                                                            client.Send({type: 'bet_accepted', data: {action: 'raise_bet'}});
                                                            client.BalanceUpdate();
                                                        }
                                                    );
                                                }
                                            );
                                        } else
                                            client.Send({
                                                type: 'bet_rejected',
                                                data: {
                                                    action: 'modify',
                                                    reason: 'balance_too_low'
                                                }
                                            })
                                    } else
                                        client.Send({
                                            type: 'bet_rejected',
                                            data: {
                                                action: 'modify',
                                                reason: 'illegal_operation'
                                            }
                                        })
                                } else
                                    client.Send({
                                        type: 'bet_rejected',
                                        data: {
                                            action: 'modify',
                                            reason: 'event_over'
                                        }
                                    })
                            } else
                                client.Send({
                                    type: 'bet_rejected',
                                    data: {
                                        action: 'modify',
                                        reason: 'illegal_operation'
                                    }
                                })
                        } else
                            client.Send({
                                type: 'bet_rejected',
                                data: {
                                    action: 'modify',
                                    reason: 'bet_notfound'
                                }
                            })
                    } else
                        client.Send({
                            type: 'bet_rejected',
                            data: {
                                action: 'modify',
                                reason: 'candidate_notfound'
                            }
                        })
                } else
                    client.Send({
                        type: 'bet_rejected',
                        data: {
                            action: 'modify',
                            reason: 'event_notfound'
                        }
                    })
            }
		}
	});
	
	client.on('close', function(reasonCode, description) {
	
		console.log((new Date()), 'CLOSE', client.__Betting.connection.IPv4, (client.__Betting.user ? client.__Betting.user.email : ''));
	});
});

const originIsAllowed = (origin) => (origin == 'https://betting.reddev2.com')
const Broadcast = (data) => WSSServer.connections.forEach((client) => client.Send(data))

const BroadcastEventList = () => WSSServer.connections.forEach((client) => client.EventListUpdate())
const BroadcastAffectedBalance = (ev) => WSSServer.connections.forEach((client) => {

    if (ev.bets.filter((b) => (b.user_id == client.__Betting.user.id)).length > 0)
        client.BalanceUpdate();
})

const UnsubscribeUsers = (ev) => {

    WSSServer.connections.forEach((client) => {
        
        if (client.__Betting.user.subscribed_to.now == ev.id) {

            client.Send({type: 'unsubscribed'});
            client.__Betting.user.subscribed_to.now = 0;
        }
    });
}

const UnsubscribeUsersWithoutBets = (ev) => {
    
    WSSServer.connections.forEach((client) => {
        
        if (client.__Betting.user.subscribed_to.now == ev.id
            && ev.bets.filter((e) => (e.user_id == client.__Betting.user.id)).length == 0
            && client.__Betting.user.account_type != 'ADMIN') {

            client.Send({type: 'unsubscribed'});
            client.__Betting.user.subscribed_to.now = 0;
        }
    });
}

const BroadcastSubscription = (ev) => {
    
    WSSServer.connections.forEach((client) => {
    
        if (client.__Betting.user.subscribed_to.now == ev.id) {
            client.Send({
                type: 'subscription_update',
                data: formatEvent(ev, client)
            });
        }
    });
}

const formatEvent = (ev, client) => {

    let now = new Date();

    return {

        id: ev.id,
        infos: {
            name: ev.infos.name,
            desc: ev.infos.desc
        },
        status: {
            open: ev.status.open,
            started: ev.status.started,
            ended: ev.status.ended,
            start: ((ev.status.start - now) / 1000),
            end: ((ev.status.end - now) / 1000),
            bcd: ((ev.status.bcd - now) / 1000)
        },
        candidates: ev.candidates,
        bets: ev.bets.map((b) => {b.mine = b.user_id == client.__Betting.user.id; return b;})
    }
}

const Tick = () => {
    
    let changes = false;
    let now = new Date();
    for (let i = 0, _cc = false, _c = false ; i < EVENTLIST.length ; i++, _cc = false, _c = false) {

        if (!EVENTLIST[i].status.ended) {

            if (EVENTLIST[i].status.open) {

                if (EVENTLIST[i].status.bcd <= now) {

                    _c = true;
                    EVENTLIST[i].status.open = false;
                }
            }

            if (!EVENTLIST[i].status.started) {

                if (EVENTLIST[i].status.start <= now) {
                    
                    _cc = true;
                    EVENTLIST[i].status.started = true;
                }
            }
            
            if (!EVENTLIST[i].status.ended) {

                if (EVENTLIST[i].status.end <= now) {
                    
                    _cc = true;
                    EVENTLIST[i].status.ended = true;
                    UnsubscribeUsersWithoutBets(EVENTLIST[i]);
                }
            }
        }

        if (_cc || _c) {
            
            BroadcastSubscription(EVENTLIST[i]);
            if (_cc) changes = true;
        }
    }

    if (changes) BroadcastEventList();

    /*Broadcast('{"type": "tick"}');*/
}


const StartServer = () => {

    HTTPSServer.listen(5000, function() {
        
        setInterval(Tick, (1000 / __Ticks));
        console.log((new Date()), 'Server is listening on port 5000, ' + __Ticks + ' ticks/s');
    });
}

const LoadEventsFromDB = () => {

    DB.query('SELECT * FROM `events`', function(err, events_list) {
        
        let now = new Date();
        let _now = parseInt(now.getTime() / 1000);
        for (let i = 0 ; i < events_list.length ; i++) {

            DB.query('SELECT * FROM `results` WHERE `_eid` = ' + events_list[i].id, function(err, results_list) {

                if (results_list.length == 0)     
                    LoadEventFromDB(events_list[i], now);
            });
        }

        StartServer();
    })
}

const LoadEventFromDB = (event, now, callback) => {

    DB.query('SELECT * FROM `candidates` WHERE `_eid` = ' + event.id, function(err, candidates_list) {

        if (candidates_list.length > 0) {

            let start = new Date((event.start_date * 1000));
            let end = new Date((event.end_date * 1000));
            let bcd = new Date(start.getTime() + (event.bcd * 60 * 1000));
        
            let newEvent = {
                id: event.id,
                infos: {
                    name: event.name,
                    desc: event.description
                },
                status: {
                    open: (bcd > now),
                    started: (now >= start),
                    ended: (now >= end),
                    start: start,
                    end: end,
                    bcd: bcd
                },
                candidates: [],
                bets: [],
                results: [],
                biggestRisk: 0
            };

            for (let i = 0 ; i < candidates_list.length ; i++) 
                newEvent.candidates.push({id: candidates_list[i].id, name: candidates_list[i].name});

            DB.query('SELECT * FROM `bets` WHERE `_eid` = ' + event.id, function(err, bets_list) {

                EVENTLIST.push(newEvent);
                let index = EVENTLIST.length - 1;

                for (let i = 0 ; i < bets_list.length ; i++) {

                    DB.query('SELECT * FROM `users` WHERE `id` = ' + bets_list[i]._uid, function(err, user) {

                        NewBet(index, bets_list[i]._uid, bets_list[i].amount, bets_list[i]._cid, user[0].username, bets_list[i].id);
                    });
                }
                
                CalculateRiskAndEarning(index);
                
                if (callback && typeof callback === "function")
                    callback();
            });
        }
    })
}

const GrantWinnerMoney = (user_id, earning) => {

    if (earning > 0) {

        DB.query('SELECT * FROM `users` WHERE `id` = ' + user_id, function(err, user) {

            console.log((user[0].balance + earning))
            DB.update('users', 
                {balance: (user[0].balance + earning)},
                {id: {operator: '=', value: user_id}},
                function(err, res) {

                    // console.log(err, res)
                    WSSServer.connections.forEach((client) => {
                        
                        if (client.__Betting.user.id == user_id) {

                            client.__Betting.user.balance += earning;
                            client.BalanceUpdate();
                        }
                    })
                }
            )
        })
    }
}

const NewBet = (index, user_id, amount, candidate_id, username, _bid) => {

    _bid = _bid | 0;
    if (_bid) {

        EVENTLIST[index].bets.push({
            id: _bid,
            user_id: user_id,
            username: username,
            candidate_id: candidate_id,
            bet: amount,
            safe: amount,
            risk: 0,
            earning: 0
        });

        let diff_candidates = false;

        for (let i = 0 ; i < EVENTLIST[index].bets.length && !diff_candidates ; i++)
            if (candidate_id != EVENTLIST[index].bets[i].candidate_id) diff_candidates = true;
    
        if (diff_candidates) {

            EVENTLIST[index].biggestRisk = Math.max(EVENTLIST[index].biggestRisk, Math.min(amount, BiggestBetExcluding(index, candidate_id)));
            CalculateRiskAndEarning(index);
        }
    } else {


        DB.insert('bets', {_uid: user_id, _eid: EVENTLIST[index].id, _cid: candidate_id, amount: amount}, function(err, bet) {

            // if (!err)
            NewBet(index, user_id, amount, candidate_id, username, bet.insertId);
            BroadcastSubscription(EVENTLIST[index]);
        });
    }
}

const CalculateRiskAndEarning = (index) => {

    for (let i = 0 ; i < EVENTLIST[index].bets.length ; i++) {
        
        EVENTLIST[index].bets[i].safe = (EVENTLIST[index].bets[i].bet > EVENTLIST[index].biggestRisk) ? EVENTLIST[index].bets[i].bet - EVENTLIST[index].biggestRisk : 0;
        EVENTLIST[index].bets[i].risk = (EVENTLIST[index].bets[i].bet > EVENTLIST[index].biggestRisk) ? EVENTLIST[index].biggestRisk : EVENTLIST[index].bets[i].bet;
    }
    
    // OPTIMIZE THAT: calculate for each candidate once
    for (let i = 0 ; i < EVENTLIST[index].bets.length ; i++)
        EVENTLIST[index].bets[i].earning = parseInt(EVENTLIST[index].bets[i].risk * EstimatedEarningForCandidate(index, EVENTLIST[index].bets[i].candidate_id) * (1 - __COMMISSION))
}

const BiggestBetExcluding = (index, candidate_id) => {

    let max = 0;
    for (let i = 0 ; i < EVENTLIST[index].bets.length - 1 ; i++)
        if (EVENTLIST[index].bets[i].candidate_id != candidate_id && EVENTLIST[index].bets[i].bet > max)
            max = EVENTLIST[index].bets[i].bet;

    return max;
}

const EstimatedEarningForCandidate = (index, candidate_id) => {
    
    var totalRiskForCandidate = 0;
    var biggestRiskForCandidate = 0;
    var totalRisk = 0;
    var totalRefunds = 0;

    for (var i = 0 ; i < EVENTLIST[index].bets.length ; i++) {

        if (EVENTLIST[index].bets[i].candidate_id == candidate_id) {

            totalRiskForCandidate += EVENTLIST[index].bets[i].risk;
            if (EVENTLIST[index].bets[i].risk > biggestRiskForCandidate)
            biggestRiskForCandidate = EVENTLIST[index].bets[i].risk;
        }

        totalRisk += EVENTLIST[index].bets[i].risk;
    }

    for (var i = 0 ; i < EVENTLIST[index].bets.length ; i++)
        if (EVENTLIST[index].bets[i].candidate_id != candidate_id)
            if (EVENTLIST[index].bets[i].risk > biggestRiskForCandidate)
                totalRefunds += EVENTLIST[index].bets[i].risk - biggestRiskForCandidate;
    
    return totalRiskForCandidate ? (totalRisk - totalRefunds) / totalRiskForCandidate : 0;
}

LoadEventsFromDB();
