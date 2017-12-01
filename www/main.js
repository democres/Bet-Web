var __token = null;
var __disconnectReason = 'Connection Lost.';
var __WSS = null;
var __WSS_KA = null;
var __ticker = null;

var __BALANCE = 0.0; var __balance_init = true;
var __virtualDOM_Bets = {myBets: [], usersBets: []};

$(document).ready(() => {

    setInterval(() => {$.post('/', {keepalive: true})}, 10000);

    if ($('#client').length > 0) {
        
        $('#balance > span:last-child').text((0).formatMoney());

        var __virtualDOM_EventsList = {incoming: [], ongoing: [], over: []}

        $('#client').on('click', '.notification-close', (e) => {

            ClearNotification($(e.currentTarget).parent().attr('id'));
        })

        $('#client').on('click', '.tab > span', (e) => {

            let _t = $(e.currentTarget);
            $('.active[data-area="' + _t.attr('data-area') + '"]').removeClass('active');
            $('[data-area="' + _t.attr('data-area') + '"][data-for="' + _t.attr('data-for') + '"]').addClass('active');
        })

        $('#client').on('click', '#ref_link', function (e) {

            e.preventDefault();
            let target = document.getElementById('__HCT__');

            if (!target) {
                
                target = document.createElement("textarea");
                target.style.position = "absolute";
                target.style.left = "-9999px";
                target.style.top = "0";
                target.id = '__HCT__';
                document.body.appendChild(target);
            }

            target.textContent = $('#ref_link').attr('data');
            target.focus();
            target.setSelectionRange(0, target.value.length);

            try {document.execCommand("copy");} catch(er) {}
            PushNotification('info', 'Referral link copied to clipboard.');
        })

        $('#client').on('click', '.event-candidate', (e) => {
            
            if (!$(e.currentTarget).hasClass('disabled')) {
                
                let _t = $(e.currentTarget);
    
                $('.event-candidate.active').removeClass('active');
                _t.addClass('active');
    
                $('#bet_candidate.placeholder').removeClass('placeholder');
                $('#bet_candidate').text(_t.text());
                $('#bet_candidate').attr('data', _t.attr('data'));
    
                $('#place_bet').removeClass('btn-primary').addClass('btn-actioncall').val('Place Bet');
                $('#place_modify_bet .event-section-header').text('Place Bet');
                if ($('#place_modify_bet').attr('data') != 0) {
                    
                    $('#bet_amount').val('');
                    $('#place_modify_bet').attr('data', '0');
                }
    
                if ($('#bet_amount').val() != '')
                    $('#place_bet.disabled').removeClass('disabled');
            }
        });
    
        $('#client').on('keyup', '#bet_amount', BetAmountChange);
        $('#client').on('change', '#bet_amount', BetAmountChange);    
    
        $('#client').on('click', '#place_bet', () => {
            
            let _b = parseFloat($('#place_modify_bet').attr('data'));
            let _a = parseFloat($('#bet_amount').val().replace(',', ''));

            if (_b == 0) {

                if ($('#bet_amount').val() != '' && $('#bet_candidate').attr('data') != '' && _a > 0 &&  _a <= __BALANCE)
                    placeBet($('#candidates_list').attr('data'), parseInt($('#bet_candidate').attr('data')), parseInt(_a * 100));

            } else {

                if ($('#bet_amount').val() != '' && $('#bet_candidate').attr('data') != '' && _a >= 0 &&  _a <= __BALANCE + _b)
                    modifyBet($('#place_modify_bet').attr('data-id'), $('#candidates_list').attr('data'), parseInt($('#bet_candidate').attr('data')), parseInt(_a * 100));
            }
        });
    
        $('#client').on('click', '#my_bets_list .event-bet:not(:first-child) > div:last-child', (e) => {
    
            let _t = $('div:first-child', $(e.currentTarget).parent());
    
            $('.event-candidate.active').removeClass('active');
            
            $('#bet_candidate.placeholder').removeClass('placeholder');
            $('#bet_candidate').text(_t.text());
            $('#bet_candidate').attr('data', _t.attr('data'));
    
            $('#place_bet').removeClass('btn-actioncall').addClass('btn-primary').val('Modify Bet');
            $('#place_modify_bet .event-section-header').text('Modify Bet');
            $('#place_modify_bet').attr('data', _t.next().text().replace(',', ''));
            $('#place_modify_bet').attr('data-id', _t.parent().attr('data'));
    
            $('#bet_amount').val(_t.next().text());
        });

        $('#client').on('keyup', '#transfer_to', TransferChange);
        $('#client').on('keyup', '#transfer_password', TransferChange);
        $('#client').on('keyup', '#transfer_amount', TransferChange);
        $('#client').on('change', '#transfer_amount', TransferChange);

        $('#client').on('click', '#transfer', () => {

            if ($('#transfer_to').val() != '' && $('#transfer_amount').val() != '' && $('#transfer_password').val() != '') {

                let _a = parseInt(parseFloat($('#transfer_amount').val()));
                if (_a > 0 && _a <= __BALANCE) {

                    transferTo($('#transfer_to').val(), _a * 100, $('#transfer_password').val());
                }
            }
        });

        __token = $('#client').attr('data');
        __WSS = new WebSocket('wss://betting.reddev2.com:5000/{' + __token + '}', 'gameserver');
        __WSS.onopen = function(m) {__WSS_KA = setInterval(SendKeepAlive, 1000 * 60 * 5);}

        __WSS.onmessage = function(m) {
            
            var data = JSON.parse(m.data);

            if (data.type == 'unsubscribed')
                ActivateBalancePanel();

            if (data.type == 'disconnect') {
                
                __disconnectReason = 'Disconnected: ';
                switch(data.data.reason) {
                    
                    case 'invalid_token': __disconnectReason += 'Invalid token. Try to Login again on the website.'; break;
                    case 'invalid_user': __disconnectReason += 'Invalid user account.'; break;
                    case 'duplicate': __disconnectReason += 'Connected somewhere else.'; break;
                    default: __disconnectReason = 'Connection Lost.'; break;
                }
            }

            if (data.type == 'balance_update') balance_to((data.data.balance / 100));

            if (data.type == 'transfer_accepted') {
                
                $('#transfer_to').val('');
                $('#transfer_amount').val('');
                $('#transfer_password').val('');
                $('#transfer').addClass('disabled')
            }

            if (data.type == 'bet_accepted') {

                $('#bet_candidate').addClass('placeholder').text('Select a Candidate').attr('data', '0');
                $('#bet_amount').val('');
                $('#place_bet').removeClass('btn-primary').addClass('btn-actioncall').addClass('disabled').val('Place Bet');
                $('#place_modify_bet').attr('data', '0').attr('data-id', '0');
                $('#place_modify_bet .event-section-header').text('Place Bet');
            }

            if (data.type == 'event_list') {
                
                let __new_EventsList = {

                    incoming: data.data.open.incoming,
                    ongoing: data.data.open.ongoing,
                    over: data.data.over
                }

                let _active_id = 0;
                if ($('#incoming li.active, #ongoing li.active, #over li.active').length > 0) {

                    _active_id = $('#incoming li.active, #ongoing li.active, #over li.active').eq(0).attr('data');
                    $('#incoming li.active, #ongoing li.active, #over li.active').removeClass('active');
                }

                // INCOMING
                for (var i = 0 ; i < __new_EventsList.incoming.length ; i++) {

                    if (i >= __virtualDOM_EventsList.incoming.length)
                        $('#incoming').append('<li data="' + __new_EventsList.incoming[i].id + '"'
                            + (__new_EventsList.incoming[i].id == _active_id ? ' class="active"' : '')
                            + '>' + __new_EventsList.incoming[i].infos.name + '</li>');
                    
                    else {
                        
                        if (__virtualDOM_EventsList.incoming[i].infos.name != __new_EventsList.incoming[i].infos.name)
                            $('#incoming li').eq(i).text(__new_EventsList.incoming[i].infos.name);

                        if (__virtualDOM_EventsList.incoming[i].id != __new_EventsList.incoming[i].id)
                            $('#incoming li').eq(i).attr('data', __new_EventsList.incoming[i].id);
                        
                        if (__new_EventsList.incoming[i].id == _active_id)
                            $('#incoming li').eq(i).addClass('active');
                    }
                }

                if (__virtualDOM_EventsList.incoming.length > __new_EventsList.incoming.length) 
                    $('#incoming li:nth-last-child(-n+' + (__virtualDOM_EventsList.incoming.length - __new_EventsList.incoming.length) + ')').remove();
                
                // ONGOING
                for (var i = 0 ; i < __new_EventsList.ongoing.length ; i++) {

                    if (i >= __virtualDOM_EventsList.ongoing.length)
                        $('#ongoing').append('<li data="' + __new_EventsList.ongoing[i].id + '"'
                            + (__new_EventsList.ongoing[i].id == _active_id ? ' class="active"' : '')
                            + '>' + __new_EventsList.ongoing[i].infos.name + '</li>');
                    
                    else {
                        
                        if (__virtualDOM_EventsList.ongoing[i].infos.name != __new_EventsList.ongoing[i].infos.name)
                            $('#ongoing li').eq(i).text(__new_EventsList.ongoing[i].infos.name);

                        if (__virtualDOM_EventsList.ongoing[i].id != __new_EventsList.ongoing[i].id)
                            $('#ongoing li').eq(i).attr('data', __new_EventsList.ongoing[i].id);
                        
                        if (__new_EventsList.ongoing[i].id == _active_id)
                            $('#ongoing li').eq(i).addClass('active');
                    }
                }

                if (__virtualDOM_EventsList.ongoing.length > __new_EventsList.ongoing.length) 
                    $('#ongoing li:nth-last-child(-n+' + (__virtualDOM_EventsList.ongoing.length - __new_EventsList.ongoing.length) + ')').remove();
                
                // OVER
                if (__new_EventsList.over.length == 0) $('#over').addClass('hide');
                else {

                    $('#over').removeClass('hide');
                    for (var i = 0 ; i < __new_EventsList.over.length ; i++) {
                        
                        if (i >= __virtualDOM_EventsList.over.length)
                            $('#over').append('<li data="' + __new_EventsList.over[i].id + '"'
                                + (__new_EventsList.over[i].id == _active_id ? ' class="active"' : '')
                                + '>' + __new_EventsList.over[i].infos.name + '</li>');
                        
                        else {
                            
                            if (__virtualDOM_EventsList.over[i].infos.name != __new_EventsList.over[i].infos.name)
                                $('#over li').eq(i).text(__new_EventsList.over[i].infos.name);

                            if (__virtualDOM_EventsList.over[i].id != __new_EventsList.over[i].id)
                                $('#over li').eq(i).attr('data', __new_EventsList.over[i].id);
                                
                            if (__new_EventsList.over[i].id == _active_id)
                                $('#over li').eq(i).addClass('active');
                        }
                    }

                    if (__virtualDOM_EventsList.over.length > __new_EventsList.over.length) 
                        $('#over li:nth-last-child(-n+' + (__virtualDOM_EventsList.over.length - __new_EventsList.over.length) + ')').remove();
                }
                __virtualDOM_EventsList = __new_EventsList;
            }

            if (data.type == 'subscription') {
                
                let _callback = null;
                __virtualDOM_Bets = {myBets: [], usersBets: []};

                clearInterval(__ticker);
                let event =
                    '<div class="event-details">' +
                        '<div class="event-header">' +
                            '<div class="event-name"><span>' + data.data.infos.name + '</span></div>' +
                            '<div class="event-infos">';

                if (data.data.status.start > 0) {
                    
                    if (data.data.status.bcd > data.data.status.start)
                        event += '<div class="event-bcd">Bet cancelation delay: <span>' + (data.data.status.bcd - data.data.status.start).formatTime() + '</span></div>';

                    event += 
                        '<div class="event-timers">' +
                            '<div class="event-start">event starts in: <span>' + data.data.status.start.formatTimer() + '</span></div>' +
                            '<div class="event-end">event ends in: <span>' + data.data.status.end.formatTimer() + '</span></div>' +
                        '</div>';
                } else {

                    if (data.data.status.bcd > 0)
                        event += '<div class="event-bcd">Bet cancelation delay: <span>' + data.data.status.bcd.formatTimer() + '</span></div>';
                    
                    else
                        event += '<div class="event-bcd">Bets for this event cannot be canceled</div>';

                    event +=
                        '<div class="event-timers">' +
                            '<div class="event-end">';

                    if (data.data.status.end > 0)
                        event += 'event ends in: <span>' + data.data.status.end.formatTimer() + '</span>';

                    else {
                        
                        if (typeof EventOverCallback === "function") _callback = EventOverCallback;
                        event += 'Event over';
                    }

                    event +=
                            '</div>' +
                        '</div>';
                }

                event +=
                            '</div>' +
                        '</div>' +
                        '<div class="event-content">' +
                            '<div class="event-sections">' +
                                '<div class="event-section max" id="candidates_list" data="' + data.data.id + '">' +
                                    '<div class="event-section-inner small">' +
                                        '<div class="event-section-header">Candidates List</div>' +
                                        '<div class="event-section-content">';

                for (let i = 0 ; i < data.data.candidates.length ; i++)
                    event += '<div class="event-candidate' + (data.data.status.end > 0 ? '' :  ' disabled') +
                            '" data="' + data.data.candidates[i].id + '">' + data.data.candidates[i].name + '</div>';

                event +=
                                        '</div>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="event-section" id="bets_list">' +
                                    '<div class="event-section-inner small">' +
                                        '<div class="event-section-header">Bets List</div>' +
                                        '<div class="event-section-content">' +
                                            '<div class="event-bet">' +
                                                '<div>User</div>' +
                                                '<div>Candidate</div>' +
                                                '<div>Bet</div>' +
                                                '<div>Safe</div>' +
                                                '<div>Risk</div>' +
                                                '<div>Estimated Profit</div>' +
                                            '</div>' +
                                        '</div>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                            '<div class="event-sections">' +
                                '<div class="event-section" id="place_modify_bet">' +
                                    '<div class="event-section-inner">' +
                                        '<div class="event-section-header">Place Bet</div>' +
                                        '<div class="event-section-content">' +
                                            '<div class="input-group">' +
                                                '<label>On</label>' +
                                                '<span id="bet_candidate" class="placeholder" data="">Select a Candidate</span>' +
                                            '</div>' +
                                            '<div class="input-group">' +
                                                '<label for="bet_amount">Amount</label>' +
                                                '<input type="number" id="bet_amount" placeholder="Required" min="0" />' +
                                            '</div>' +
                                            '<div class="input-group">' +
                                                '<label>Estimated Profit</label>' +
                                                '<span id="est_profit">0.00</span>' +
                                            '</div>' +
                                            '<div class="input-group">' +
                                                '<input type="submit" id="place_bet" value="Place Bet" class="btn btn-actioncall disabled" />' +
                                            '</div>' +
                                        '</div>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="event-section" id="my_bets_list">' +
                                    '<div class="event-section-inner small">' +
                                        '<div class="event-section-header">Your Bets</div>' +
                                        '<div class="event-section-content">' +
                                            '<div class="event-bet">' +
                                                '<div>Candidate</div>' +
                                                '<div>Bet</div>' +
                                                '<div>Safe</div>' +
                                                '<div>Risk</div>' +
                                                '<div>Estimated Profit</div>' +
                                                '<div class="fixed20"></div>' +
                                            '</div>' +
                                        '</div>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>';

                $('#middle-panel > .content').html(event);

                if (_callback) _callback();
                
                registerTicker({start: data.data.status.start, end: data.data.status.end, bcd: data.data.status.bcd});
                updateBetList(data.data.bets, data.data.candidates);
                updateCandidatesList(data.data.status.ended, data.data.bets.filter((b) => b.mine), data.data.candidates);
            }

            if (data.type == 'subscription_update') {
                
                let _callback = null;
                clearInterval(__ticker);

                if (data.data.status.end > 0) {
                    
                    if (data.data.status.start > 0) 
                        $('.event-start span').text(data.data.status.start.formatTimer());
        
                    else {
        
                        $('.event-start').remove();
        
                        if (data.data.status.bcd > 0)
                            $('.event-bcd span').text(data.data.status.bcd.formatTimer());
                        
                        else
                            $('.event-bcd').html('Bets for this event cannot be canceled');
                    }
        
                    $('.event-end span').text(data.data.status.end.formatTimer());
                }
                
                else {

                    if (typeof EventOverCallback === "function") _callback = EventOverCallback;
                    $('.event-end').html('Event over');
                }

                if (_callback) _callback();

                registerTicker({start: data.data.status.start, end: data.data.status.end, bcd: data.data.status.bcd});
                updateBetList(data.data.bets, data.data.candidates);
                updateCandidatesList(data.data.status.ended, data.data.bets.filter((b) => b.mine), data.data.candidates);
            }
        };
        
        __WSS.onclose = function(m) {

            clearInterval(__WSS_KA);
            //$('#client').after('<div id="disconnected">' + __disconnectReason + '</div>');
            $('.modal-inner').html('<div class="event-section-inner medium red">' + __disconnectReason + '</div>');
            $('.modal-outer').addClass('show');
        };

        $('#balance').on('click', ActivateBalancePanel);
        ActivateBalancePanel();

        $('#events-list').on('click', 'li', (e) => {
            
            $('#left-panel li.active').removeClass('active');
            $(e.currentTarget).addClass('active');

            var content = 
                '<div class="content">' +
                '</div>';

            $('#middle-panel').html(content);
            subscribeTo($(e.currentTarget).attr('data'));
        });
    }
});

const ActivateBalancePanel = () => {

    $('#left-panel li.active').removeClass('active');
    $('#balance').addClass('active');
    if (__WSS_KA) unsubcribe();

    let _referral_token = $('#client').attr('data-ref');
    let content =
        '<div class="content">' +
            '<div class="event-details">' +
                '<div class="event-header">' +
                    '<div class="event-name"><span>Balance Overview</span></div>' +
                '</div>' +
                '<div class="event-content">' +
                    '<div class="event-sections">' +
                        '<div class="event-section">' +
                            '<div class="event-section-header tab">' +
                                '<span class="active" data-area="funds" data-for="manage">Manage Funds</span>' +
                                '<span data-area="funds" data-for="history">History</span>' +
                            '</div>' +
                            '<div class="event-section-inner tab-panel active" data-area="funds" data-for="manage">' +
                                '<div class="event-section-header">Deposit Funds</div>' +
                                '<div class="event-section-content">' +
                                '</div>' +
                                '<div class="event-section-header">Withdraw Funds</div>' +
                                '<div class="event-section-content">' +
                                '</div>' +
                            '</div>' +
                            '<div class="event-section-inner small tab-panel" data-area="funds" data-for="history">' +
                                '<div class="event-bet">' +
                                    '<div>Date</div>' +
                                    '<div class="grow2">Action</div>' +
                                    '<div class="grow2">Amount</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="event-section" id="referrals">' +
                            '<div class="event-section-inner small">' +
                                '<div class="event-section-header">' +
                                    '<div>Affiliates</div>' +
                                    '<div class="event-section-header-pulled">' +
                                        '<a href="" id="ref_link" data="https://betting.reddev2.com/?ref=' + _referral_token + '">/?ref=' + _referral_token + '</a>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="event-section-content">' +
                                    '<div class="event-bet">' +
                                        '<div>Username</div>' +
                                        '<div></div>' +
                                        '<div></div>' +
                                        '<div>Your Share</div>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="event-sections">' +
                        '<div class="event-section">' +
                            '<div class="event-section-header tab">' +
                                '<span class="active" data-area="transfer" data-for="action">Transfer Funds</span>' +
                                '<span data-area="transfer" data-for="history">History</span>' +
                            '</div>' +
                            '<div class="event-section-inner tab-panel active" data-area="transfer" data-for="action">' +
                                '<div class="event-section-content">' +
                                    '<div class="input-group">' +
                                        '<label for="transfer_to">Player Username</label>' +
                                        '<input type="text" id="transfer_to" placeholder="Required" />' +
                                    '</div>' +
                                    '<div class="input-group">' +
                                        '<label for="transfer_amount">Amount</label>' +
                                        '<input type="number" id="transfer_amount" placeholder="Required" min="0" />' +
                                    '</div>' +
                                    '<div class="input-group">' +
                                        '<label for="transfer_password">Password</label>' +
                                        '<input type="password" id="transfer_password" placeholder="Required" />' +
                                    '</div>' +
                                    '<div class="input-group">' +
                                        '<input type="submit" id="transfer" value="Transfer" class="btn btn-primary disabled" />' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                            '<div class="event-section-inner small tab-panel" data-area="transfer" data-for="history">' +
                                '<div class="event-bet">' +
                                    '<div>Date</div>' +
                                    '<div>Username</div>' +
                                    '<div>Action</div>' +
                                    '<div>Amount</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';

    $('#middle-panel').html(content);

    $.post('/history.php', {history: 'referrals'}, function(data) {

        for (let i = 0 ; i < data.length ; i++)
            $('#referrals .event-section-content').append('<div class="event-bet"><div>' + data[i].username + '</div><div></div><div></div><div>' + data[i].share + '</div></div>');
    }, 'json');
}

const SendKeepAlive = () => __WSS.send(JSON.stringify({type: 'keep_alive'}))

const balance_to = (target) => {

	var timer = 0.65;
	var fps = 75;
	target = (parseFloat(target) < 0) ? 0 : parseFloat(target);
    
	var balance = $('#balance > span:last-child');
    var current = __BALANCE;
    var step = (target - current) / (timer * fps);
    __BALANCE = target;
    
    var color = balance.css('color');

	if (step != 0) {
		
		if (step > 0) {
            
            balance.css('color', '#60ad5e');
            if (!__balance_init) PushNotification('success', 'You received ' + (target - current).formatMoney() + '!');
        } else {
            
            balance.css('color', '#CA2222');
            if (!__balance_init) PushNotification('info', (target - current).formatMoney() + ' debited.');
        }

        if (__balance_init) __balance_init = false;
		
		var interval = setInterval(function() {
			
            current += step;
 
			if (step > 0 && current >= target) current = target;
			if (step < 0 && current <= target) current = target;
			
            if (current == target) {clearInterval(interval); balance.css('color', color);}

			balance.text(current.formatMoney());
		}, (1000 / fps));
	}
}

Number.prototype.formatMoney = function (c, d, t) {
    
    var n = this, 
        c = isNaN(c = Math.abs(c)) ? 2 : c, 
        d = d == undefined ? "." : d, 
        t = t == undefined ? "," : t, 
        s = n < 0 ? "-" : "", 
        i = parseInt(n = Math.abs(+n || 0).toFixed(c)) + "", 
        j = (j = i.length) > 3 ? j % 3 : 0;
    return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : "");
};

Number.prototype.formatTimer = function() {

    var n = this,
        s = parseInt(n),
        m = parseInt(s / 60),
        h = parseInt(m / 60),
        d = parseInt(h / 24),
        M = parseInt(d / 30),
        w = (M > 0 ? 0 : parseInt(d / 7));

    if (n <= 0) return '';

    s -= (m * 60);
    m -= (h * 60);
    h -= (d * 24);
    d -= (M * 30 + w * 7);

    return (M > 0 ? (M + 'M ') : (w > 0 ? (w + 'W ') : ''))
        + (d > 0 ? (d + 'D ') : '') + ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2);
}

Number.prototype.formatTime = function() {
    
    var n = this,
        s = parseInt(n),
        m = parseInt(s / 60),
        h = parseInt(m / 60),
        d = parseInt(h / 24),
        M = parseInt(d / 30),
        w = (M > 0 ? 0 : parseInt(d / 7));

    if (n <= 0) return '';

    s -= (m * 60);
    m -= (h * 60);
    h -= (d * 24);
    d -= (M * 30 + w * 7);

    return (M > 0 ? (M + ' month' + (M > 1 ? 's' : '') + ' ') : (w > 0 ? (w + ' week' + (w > 1 ? 's' : '') + ' ') : ''))
        + (d > 0 ? (d + ' day' + (d > 1 ? 's' : '') + ' ') : '')
        + (h > 0 ? (h + ' hour' + (h > 1 ? 's' : '') + ' ') : '')
        + (m > 0 ? (m + ' minute' + (m > 1 ? 's' : '') + ' ') : '')
        + (s > 0 ? (s + ' second' + (s > 1 ? 's' : '') + ' ') : '')
}


const subscribeTo = (id) => {

    let data = {
        type: 'subsribe_event',
        data: {
            id: id
        }
    };

    __WSS.send(JSON.stringify(data));
}

const unsubcribe = () => {

    clearInterval(__ticker);

    let data = {type: 'unsubsribe_event'};
    __WSS.send(JSON.stringify(data));
}

const registerTicker = (timers) => {

    var _prev = {
        start: timers.start,
        end: timers.end,
        bcd: timers.bcd
    };

    __ticker = setInterval(() => {
        
        timers.start--;
        timers.end--;
        timers.bcd--;

        if (timers.end > 0) {

            if (timers.start > 0) 
                $('.event-start span').text(timers.start.formatTimer());

            else {

                if (_prev.start > 0)
                    $('.event-start').remove();

                if (timers.bcd > 0)
                    $('.event-bcd span').text(timers.bcd.formatTimer());
                
                else if (_prev.bcd > 0)
                    $('.event-bcd').html('Bets for this event cannot be canceled');
            }

            $('.event-end span').text(timers.end.formatTimer());
        } else {

            if (_prev.end > 0)
                $('.event-end').html('Event over');
            
            else
                clearInterval(__ticker);
        }

        _prev = {
            start: timers.start,
            end: timers.end,
            bcd: timers.bcd
        };
    }, 1000);
}

const transferTo = (username, amount, password) => {

    let data = {

        type: 'transfer',
        data: {
            to: username,
            amount: amount,
            password: password
        }
    }

    __WSS.send(JSON.stringify(data));
}

const placeBet = (event_id, candidate_id, amount) => {

    let data = {

        type: 'bet',
        data: {
            id: event_id,
            candidate: candidate_id,
            amount: amount
        }
    }

    __WSS.send(JSON.stringify(data));
}

const modifyBet = (bet_id, event_id, candidate_id, amount) => {

    let data = {

        type: 'modify_bet',
        data: {
            id: bet_id,
            event: event_id,
            candidate: candidate_id,
            amount: amount
        }
    }
    
    __WSS.send(JSON.stringify(data));
}

const updateCandidatesList = (ended, myBets, candidates) => {

    let myBets_c = myBets.map((b) => b.candidate_id);

    if (ended) $('.event-candidate').addClass('disabled');
    else {

        for (let i = 0 ; i < candidates.length ; i++)
            if (myBets_c.indexOf(candidates[i].id) != -1)
                $('.event-candidate[data="' + candidates[i].id + '"]').addClass('disabled');
            else
                $('.event-candidate[data="' + candidates[i].id + '"]').removeClass('disabled');
    }
}

const updateBetList = (bets, candidates) => {

    let usersBets = bets.filter((b) => (!b.mine));
    let myBets = bets.filter((b) => (b.mine));

    for (var i = 0 ; i < usersBets.length ; i++) {
        
        if (i >= __virtualDOM_Bets.usersBets.length)
            $('#bets_list .event-section-content').append(
                '<div class="event-bet" data="' + usersBets[i].id + '">' +
                    '<div>' + usersBets[i].username + '</div>' +
                    '<div>' + candidates.filter((c) => c.id == usersBets[i].candidate_id)[0].name + '</div>' +
                    '<div>' + (usersBets[i].bet / 100).formatMoney() + '</div>' +
                    '<div>' + (usersBets[i].safe / 100).formatMoney() + '</div>' +
                    '<div>' + (usersBets[i].risk / 100).formatMoney() + '</div>' +
                    '<div>' + ((usersBets[i].earning - usersBets[i].risk) / 100).formatMoney() + '</div>' +
                '</div>'
        );
        
        else {

            if (__virtualDOM_Bets.usersBets[i].id != usersBets[i].id)
                $('#bets_list .event-bet').eq(i + 1).attr('data', usersBets[i].id);

            if (__virtualDOM_Bets.usersBets[i].username != usersBets[i].username)
                $('div', $('#bets_list .event-bet').eq(i + 1)).eq(0).text(usersBets[i].username);

            if (__virtualDOM_Bets.usersBets[i].candidate_id != usersBets[i].candidate_id)
                $('div', $('#bets_list .event-bet').eq(i + 1)).eq(1).text(candidates.filter((c) => c.id == usersBets[i].candidate_id)[0].name);

            if (__virtualDOM_Bets.usersBets[i].bet != usersBets[i].bet)
                $('div', $('#bets_list .event-bet').eq(i + 1)).eq(2).text((usersBets[i].bet / 100).formatMoney());

            if (__virtualDOM_Bets.usersBets[i].safe != usersBets[i].safe)
                $('div', $('#bets_list .event-bet').eq(i + 1)).eq(3).text((usersBets[i].safe / 100).formatMoney());

            if (__virtualDOM_Bets.usersBets[i].risk != usersBets[i].risk) {

                $('div', $('#bets_list .event-bet').eq(i + 1)).eq(4).text((usersBets[i].risk / 100).formatMoney());
                $('div', $('#bets_list .event-bet').eq(i + 1)).eq(5).text(((usersBets[i].earning - usersBets[i].risk) / 100).formatMoney());
            }

            if (__virtualDOM_Bets.usersBets[i].earning != usersBets[i].earning)
                $('div', $('#bets_list .event-bet').eq(i + 1)).eq(5).text(((usersBets[i].earning - usersBets[i].risk) / 100).formatMoney());
        }
    }

    if (__virtualDOM_Bets.usersBets.length > usersBets.length) 
        $('#bets_list .event-bet:nth-last-child(-n+' + (__virtualDOM_Bets.usersBets.length - usersBets.length) + ')').remove();


    let sum = myBets.reduce((a, b) => {return {risk: a.risk + b.risk}}, {risk: 0}).risk;

    for (var i = 0 ; i < myBets.length ; i++) {
        
        if (i >= __virtualDOM_Bets.myBets.length)
            $('#my_bets_list .event-section-content').append(
                '<div class="event-bet" data="' + myBets[i].id + '">' +
                    '<div data="' + myBets[i].candidate_id + '">' + candidates.filter((c) => c.id == myBets[i].candidate_id)[0].name + '</div>' +
                    '<div>' + (myBets[i].bet / 100).formatMoney() + '</div>' +
                    '<div>' + (myBets[i].safe / 100).formatMoney() + '</div>' +
                    '<div>' + (myBets[i].risk / 100).formatMoney() + '</div>' +
                    '<div' + ((myBets[i].earning - sum) < 0 ? ' class="loss"' : '') + '>' + ((myBets[i].earning - sum) / 100).formatMoney() + '</div>' +
                    '<div class="edit-bet fixed20"><i class="fa fa-cog" aria-hidden="true"></i></div>' + 
                '</div>'
        );
        
        else {

            if (__virtualDOM_Bets.myBets[i].id != myBets[i].id)
                $('#my_bets_list .event-bet').eq(i + 1).attr('data', myBets[i].id);

            if (__virtualDOM_Bets.myBets[i].candidate_id != myBets[i].candidate_id) {

                $('div', $('#my_bets_list .event-bet').eq(i + 1)).eq(0).text(candidates.filter((c) => c.id == myBets[i].candidate_id)[0].name);
                $('div', $('#my_bets_list .event-bet').eq(i + 1)).eq(0).attr('data', candidates.filter((c) => c.id == myBets[i].candidate_id)[0].id);
            }

            if (__virtualDOM_Bets.myBets[i].bet != myBets[i].bet)
                $('div', $('#my_bets_list .event-bet').eq(i + 1)).eq(1).text((myBets[i].bet / 100).formatMoney());

            if (__virtualDOM_Bets.myBets[i].safe != myBets[i].safe)
                $('div', $('#my_bets_list .event-bet').eq(i + 1)).eq(2).text((myBets[i].safe / 100).formatMoney());

            if (__virtualDOM_Bets.myBets[i].risk != myBets[i].risk) {

                $('div', $('#my_bets_list .event-bet').eq(i + 1)).eq(3).text((myBets[i].risk / 100).formatMoney());
                $('div', $('#my_bets_list .event-bet').eq(i + 1)).eq(4).text(((myBets[i].earning - sum) / 100).formatMoney());
                $('div', $('#my_bets_list .event-bet').eq(i + 1)).eq(4).toggleClass('loss', (myBets[i].earning - sum < 0));
            }
            
            if (__virtualDOM_Bets.myBets[i].earning != myBets[i].earning) {

                $('div', $('#my_bets_list .event-bet').eq(i + 1)).eq(4).text(((myBets[i].earning - sum) / 100).formatMoney());
                $('div', $('#my_bets_list .event-bet').eq(i + 1)).eq(4).toggleClass('loss', (myBets[i].earning - sum < 0));
            }
        }
    }

    if (__virtualDOM_Bets.myBets.length > myBets.length) 
        $('#my_bets_list .event-bet:nth-last-child(-n+' + (__virtualDOM_Bets.myBets.length - myBets.length) + ')').remove();


    __virtualDOM_Bets.usersBets = usersBets;
    __virtualDOM_Bets.myBets = myBets;
}

const TransferChange = () => {

    if ($('#transfer_to').val() != '' && $('#transfer_amount').val() != '' && $('#transfer_password').val() != '') {
 
        let _a = parseInt(parseFloat($('#transfer_amount').val()));

        if (_a > 0 && _a <= __BALANCE) {

            $('#transfer.disabled').removeClass('disabled');
        } else $('#transfer').addClass('disabled');
    } else $('#transfer').addClass('disabled');
}

const BetAmountChange = () => {

    let _b = parseFloat($('#place_modify_bet').attr('data'));
    let _a = parseFloat($('#bet_amount').val().replace(',', ''));

    if (_b == 0) {

        if (_a < 0) $('#bet_amount').val(0);
        else if (_a > __BALANCE) $('#bet_amount').val(__BALANCE);

        if ($('#bet_amount').val() != '' && $('#bet_candidate').attr('data') != '' && _a > 0 &&  _a <= __BALANCE) 
            $('#place_bet.disabled').removeClass('disabled');

        else $('#place_bet').addClass('disabled');
    } else {

        if (_a > _b) {

            if (_a > __BALANCE + _b) {$('#bet_amount').val(__BALANCE + _b); _a = parseFloat($('#bet_amount').val());}
            $('#place_bet.disabled').removeClass('disabled');         
            $('#place_bet').val('Raise +' + (_a - _b).formatMoney());   
        } else if (_a < _b && _a > 0) {
            
            $('#place_bet.disabled').removeClass('disabled');         
            $('#place_bet').val('Lower -' + (_b - _a).formatMoney());   
        } else if (_a <= 0) {
            
            if (_a < 0) {$('#bet_amount').val(0); _a = parseFloat($('#bet_amount').val());}
            $('#place_bet.disabled').removeClass('disabled');         
            $('#place_bet').val('Remove Bet');   
        } else {

            $('#place_bet').addClass('disabled');         
            $('#place_bet').val('Modify Bet');
        }
    }
}

_nID = 0;
const PushNotification = (type, text) => {

    let _id = _nID;
    setTimeout(function() {

        ClearNotification('n-' + _id);
    }, 10000);

    let _n =
        '<div class="notification ' + type + '" id="n-' + _id + '">' +
            '<div class="notification-text">' + text + '</div>' +
            '<div class="notification-close">×</div>' +
        '</div>';
    $('.notifications-wrapper').append(_n);
    $('#n-' + _id).hide().fadeIn(350);

    _nID++;
}

const ClearNotification = (id) => {

    $('#' + id).fadeOut(350, function() {

        $(this).remove();
    })
}
