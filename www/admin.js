$(document).ready(() => {

    var candidates_id = 2;
    $('#client').on('change', '#start-time', () => {

        let now = new Date();
        if ($('#start-time').datetimepicker('getValue') < now)
            $('#start-time').datetimepicker('setOptions', {value: now});
        
        if ($('#end-time').datetimepicker('getValue') < $('#start-time').datetimepicker('getValue'))
            $('#end-time').datetimepicker('setOptions', {value: $('#start-time').datetimepicker('getValue'), minDate: $('#start-time').datetimepicker('getValue')});
    });

    $('#client').on('change', '#end-time', () => {
    
        if ($('#end-time').datetimepicker('getValue') < $('#start-time').datetimepicker('getValue'))
            $('#end-time').datetimepicker('setOptions', {value: $('#start-time').datetimepicker('getValue')});
    });

    $('#client').on('click', '#btn-add-event', () => {

        var _candidates = [];
        for (var i = 0 ; i < candidates_id ; i++)
            if ($('#candidate' + i).val())
                _candidates.push($('#candidate' + i).val());
        
        if ($('#name').val() != '' && $('#start-time').val() != '' && $('#end-time').val() != '' && $('#period').val() != '' && _candidates.length > 1) {
            
            var now = new Date();
            var start = $('#start-time').datetimepicker('getValue');
            var end = $('#end-time').datetimepicker('getValue');

            var event = {
                name: $('#name').val(),
                candidates: _candidates,
                date: {
                    start: ((start - now) / 1000),
                    end: ((end - now) / 1000),
                    bcd: $('#period').val()
                }
            };

            addEvent(event);
            $('#middle-panel').html('');
            $('#add-event').click();
        }
        
        else {console.log('invalid_event')}
    })

    $('#client').on('click', '#add-event', (e) => {
        
        $('#left-panel li.active').removeClass('active');
        $(e.currentTarget).addClass('active');
        unsubcribe();

        candidates_id = 2;
        let content =
            '<div class="content not-event">' +
                '<div class="event-details">' +
                    '<div class="event-header">' +
                        '<div class="event-name"><span>New Event Panel</span></div>' +
                    '</div>' +
                    '<div class="event-content">' +
                        '<div class="event-sections">' +
                            '<div class="event-section">' +
                                '<div class="event-section-inner">' +
                                    '<div class="event-section-header">Add an Event</div>' +
                                    '<div class="event-section-content">' +
                                        '<div class="input-group">' +
                                            '<label for="name">Event Name</label>' +
                                            '<input type="text" id="name" name="name" placeholder="Required" />' +
                                        '</div>' +
                                        '<div class="input-group">' +
                                            '<label for="start-time">Event Starts</label>' +
                                            '<input type="text" id="start-time" name="start-time" placeholder="Required" />' +
                                        '</div>' +
                                        '<div class="input-group">' +
                                            '<label for="end-time">Event Ends</label>' +
                                            '<input type="text" id="end-time" name="end-time" placeholder="Required" />' +
                                        '</div>' +
                                        '<div class="input-group">' +
                                            '<label for="period">Bet Cancelation Delay</label>' +
                                            '<input type="number" id="period" name="period" placeholder="Required" min="0" value="0" />' +
                                        '</div>' +
                                        '<div id="candidates">' +
                                            '<div class="input-group">' +
                                                '<label for="candidate0">Candidate #1</label>' +
                                                '<input type="text" id="candidate0" name="candidate0" placeholder="Required" />' +
                                            '</div>' +
                                            '<div class="input-group">' +
                                                '<label for="candidate1">Candidate #2</label>' +
                                                '<input type="text" id="candidate1" name="candidate1" placeholder="Required" />' +
                                            '</div>' +
                                        '</div>' +
                                        '<div class="input-group">' +
                                            '<label for="add-candidate"></label>' +
                                            '<input type="text" id="add-candidate" name="add-candidate" placeholder="+ Add a candidate" />' +
                                        '</div>' +                    
                                        '<div class="input-group">' +
                                            '<input type="submit" id="btn-add-event" name="btn-add-event" value="Add Event" class="btn btn-primary" />' +
                                        '</div>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="event-sections">' +
                            '<div class="event-section">' +
                                '<div class="event-section-header tab">' +
                                    '<span class="active" data-area="generator" data-for="add">Add a Generator</span>' +
                                    '<span  data-area="generator" data-for="manage">Manage Generator</span>' +
                                '</div>' +
                                '<div class="event-section-inner tab-panel active" data-area="generator" data-for="add">' +
                                    '<div class="event-section-content">' +
                                    '</div>' +
                                '</div>' +
                                '<div class="event-section-inner small tab-panel" data-area="generator" data-for="manage">' +
                                    '<div class="event-section-content">' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '<div>' +
            '</div>';

        $('#middle-panel').html(content);

        jQuery('#start-time').datetimepicker({value: new Date(), step: 15, minDate: 0, minTime: 0, yearStart: new Date().getFullYear()});
        jQuery('#end-time').datetimepicker({value: new Date(), step: 15, minDate: 0, minTime: 0, yearStart: new Date().getFullYear()});

        $('#add-candidate').on('focus', () => {
            
            var input_group =
                '<div class="input-group">' +
                    '<label for="candidate'+ candidates_id +'">Candidate #' + (candidates_id + 1) + '</label>' +
                    '<input type="text" id="candidate'+ candidates_id +'" name="candidate'+ candidates_id +'" placeholder="Leave empty to ignore" />' +
                '</div>';

            $('#candidates').append(input_group);
            $('#candidate'+ candidates_id).val($('#add-candidate').val()).focus();
            $('#add-candidate').val('');
            candidates_id++;
        });
    });

    $('#client').on('click', '#btn-cancel', () => {$('.modal-outer').removeClass('show');})
    $('#client').on('click', '#btn-update_results', () => {addEventResults($('#candidates_list').attr('data'), [$('#winner-candidate').val()]); $('.modal-outer').removeClass('show');})
    $('#client').on('click', '.event-results .btn', () => {

        let content =
            '<div class="event-section-inner">' +
                '<div class="event-section-header">Update Results for this Event</div>' +
                '<div class="input-group">' +
                    '<label>Winner</label>' +
                    '<select id="winner-candidate">';

        for (let i = 0 ; i < $('.event-candidate').length ; i++)
            content += '<option value="' + $('.event-candidate').eq(i).attr('data') + '">' +  $('.event-candidate').eq(i).text() + '</option>';

        content +=
                    '</select>' +
                '</div>' +
                // '<div class="input-group">' +
                //     '<label for="add-candidate"></label>' +
                //     '<input type="text" id="add-candidate" name="add-candidate" placeholder="+ Add a candidate" />' +
                // '</div>' + 
            '</div>' +
            '<div class="event-section-header tab bottom">' +
                '<span id="btn-cancel">Cancel</span>' +
                '<span id="btn-update_results" class="active">Set Results</span>' +
            '</div>';
        
        $('.modal-inner').html(content).removeClass('red');
        $('.modal-outer').addClass('show');
    })
})

const addEvent = (event) => {
    
    let data = {
        type: 'add_event',
        data: event
    };

    __WSS.send(JSON.stringify(data));
}

const addEventResults = (event_id, results) => {

    let data = {

        type: 'update_results',
        data: {
            id: event_id,
            results: results
        }
    }

    __WSS.send(JSON.stringify(data));
}

const EventOverCallback = () => {

    $('.event-name').after('<div class="event-results"><div class="btn btn-primary">Update Resutls</div></div>');
}
