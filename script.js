/**
 * CromeBookmarks plugin
 */
(function($) {
    $.fn.CromeBookmarks = function(url, options) {
        var that = this;
        var defaults = {
            loadFavicons: false,
            decrypt: false,
            cookieid: 'chrome-bookmarks',
            search: $('form:first'), // form selector
            form: $('form:first') // form selector
        };
        options = $.extend({}, defaults, options);

        if (options.loadFavicons) {
            $(that).show();
        }

        var dataIndex = [],
            inSearch = false,
            found = false,
            $notice = $('<div>').addClass('notice').appendTo('body');

        var getBookmarks = function(data) {
            var ret = '';

            for (var i in data) {
                if (typeof data[i] !== 'object') {
                    continue;
                }
                if ('type' in data[i] && 'name' in data[i] &&
                        data[i].name != 'Synced bookmarks') {

                    var type = data[i].type == 'folder' ? 'folder' : 'file',
                        className = type == 'folder' ? 'class="folder"' : '',
                        url = type == 'folder' ?
                            'javascript:void(0);' : data[i].url,
                        a = '<a id="item-' + data[i].id + '" data-item="' +
                            data[i].id + '" href="' + url + '">' +
                            (data[i].name || '(no label)') + '</a>',
                        li = '<li ' + className + '>' + a;

                    dataIndex[dataIndex.length] = {
                        id: data[i].id,
                        type: type,
                        name: data[i].name,
                        url: type == 'folder' ? '' : data[i].url
                    };

                    if (type == 'folder' && data[i].children.length) {
                        li += '<ul>' + getBookmarks(data[i].children) + '</ul>';
                    }
                    li += '</li>';

                    ret += li;
                }
            }

            return ret;
        };

        var opened = {};
        var getOpened = function() {
            var cookies = $.cookie(options.cookieid);
            var ret = {};
            if (cookies) {
                var arr = cookies.split(',');
                for (var i = 0; i < arr.length; i++) {
                    var id = 'item-' + arr[i];
                    var parent = $('#' + id).parent();
                    if (parent.length) {
                        parent.addClass('open').loadFavicons();
                        ret[id] = arr[i];
                    }
                }
            }
            return ret;
        };
        var saveOpened = function() {
            var arr = [];
            for (var i in opened) {
                arr.push(opened[i]);
            }
            $.cookie(options.cookieid, arr.join(','));
        };
        var toggleFolder = function() {
            if (inSearch) {
                return false;
            }

            var id = $(this).data('item');
            var li = $(this).parent();
            var open = li.hasClass('open') ? true : false;
            if (open) {
                li.removeClass('open');
                if ('item-' + id in opened) {
                    delete opened['item-' + id];
                }
            } else {
                li.addClass('open').loadFavicons();
                opened['item-' + id] = id;
            }
            saveOpened();
            return false;
        };

        var initSearch = function($form) {
            var input = $form.find('input[name="query"]'),
                cancel = $('a.clr_search'),
                keyPressTimeout;

            cancel.click(function() {
                input.val('');
                clear();
                return false;
            });

            var clear = function() {
                $(that).removeClass('insearch');
                $('a', that).removeClass('hl');
                $('li', that).removeClass('open');
                opened = getOpened();
                inSearch = false;
                cancel.hide();
                $notice.hide();
            };

            var openItem = function(obj) {
                $('#item-' + obj.id)
                    .addClass('hl')
                    .parents('li')
                    .addClass('open')
                    .loadFavicons();
            };

            var search = function() {
                var val = input.val();
                if (val.length > 2) {
                    $(that).addClass('insearch');
                    $('a', that).removeClass('hl');
                    $('li', that).removeClass('open');
                    inSearch = true;
                    found = false;
                    $notice.hide();

                    try {
                        var pattern = new RegExp(val, 'i');
                        for (var i = 0; i < dataIndex.length; i++) {
                            if (pattern.test(dataIndex[i].name) ||
                                    pattern.test(dataIndex[i].url)) {
                                openItem(dataIndex[i]);
                                found = true;
                            }
                        }
                    } catch (e) {}

                    if (!found) {
                        $notice.text('No matching results').show();
                    }

                } else {
                    clear();
                }
                if (val.length) {
                    cancel.show();
                }
            };

            input.bind('keyup', function() {
                clearTimeout(keyPressTimeout);
                keyPressTimeout = setTimeout(search, 1e3);
            });
            $form.on('submit', function() {
                console.log('submit');
                search();
                return false;
            });
        };

        var setData = function(data) {
            $(that).html(getBookmarks(data.roots));
            $('.folder > a', that).click(toggleFolder);
            opened = getOpened();
            $(that).css({display: 'block'});
            if (options.search) {
                initSearch(options.search);
            }
        };
        var errorCallback = function(resp) {
            if (resp.status == 404) {
                $(that).text("File '" + url + "' not found!")
                    .css('color', 'red');
            }
        };

        var cacheBuster = Math.round(new Date() / (1000 * 60));

        if (options.decrypt) {
            var $form = options.form;

            var passInput = $form.find('input[type="password"]');
            //var goButton = $form.find('button[type="submit"]');
            var searchInput = $form.find('input[type="text"]');
            var passCheckbox = $form.find('input[type="checkbox"]');
            var passDiv = $form.find('.passDiv');

            var passCookie = $.cookie('pass');
            if (passCookie) {
                passInput.val(passCookie);
            }
            searchInput.hide();
            passInput.focus();
            $form.on('submit.authentication', function(e) {
                e.preventDefault();
                $(that).append(
                    '<p> Fetching Bookmarks... </p>');
                $.ajax({
                    url: url,
                    data: {cb: cacheBuster},
                    dataType: 'text',
                    success: function(data) {
                        $(that).append(
                            '<p> Decrypting Bookmarks... </p>');
                        //$(that).text("decrypting...").css( 'color', 'blue');
                        var words = CryptoJS.AES.decrypt(data, passInput.val());
                        try {
                            data = words.toString(CryptoJS.enc.Utf8);
                            data = $.parseJSON(data);
                        } catch (e) {
                            $(that).append('<p>' + e +
                                ' - wrong password?</p>').css('color', 'red');
                            return;
                        }
                        console.log(passInput.val());
                        if (passCheckbox.attr('checked')) {
                            $.cookie('pass', passInput.val());
                        }
                        $form.off('submit.authentication');
                        //goButton.hide();
                        //passInput.hide();
                        passDiv.hide();
                        searchInput.show();
                        searchInput.focus();
                        setData(data);
                    },
                    error: errorCallback
                });
            });
        } else {
            $.ajax({
                url: url,
                data: {cb: cacheBuster},
                dataType: 'json',
                success: function(data) {
                    setData(data);
                },
                error: errorCallback
            });
        }

        $.fn.loadFavicons = function() {
            if (!options.loadFavicons) {
                return;
            }

            var preloader = $('<div id="imgpreload" />').appendTo($('body'));
            $(this).find('> ul > li > a').not('.folder').each(function() {
                var url = $(this).attr('href');
                var link = $(this);
                try {
                    var host = /(http[s]?:\/\/[a-z-_0-9\.]+)/i.exec(url);
                    if (host.length > 1) {
                        url = host[1] + '/favicon.ico';
                        $('<img>').load(function() {
                            if ($(this).width()) {
                                link.css({
                                    'background-image': "url('" + url + "')",
                                    'background-position': 'left',
                                    'background-size': '16px 16px'
                                });
                            }
                        })
                        .attr('src', url)
                        .appendTo(preloader);
                    }
                } catch (e) {}
            });
        };

    };

})(jQuery);


/**
 * jQuery Cookie plugin
 *
 * Copyright (c) 2010 Klaus Hartl (stilbuero.de)
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 */
(function($) {
    $.cookie = function(key, value, options) {

        // key and at least value given, set cookie...
        if (arguments.length > 1 &&
            (Object.prototype.toString.call(value) === '[object String]' ||
            value === null || value === undefined)
        ) {
            options = $.extend({}, options);

            if (value === null || value === undefined) {
                options.expires = -1;
            }

            if (typeof options.expires === 'number') {
                var days = options.expires, t = options.expires = new Date();
                t.setDate(t.getDate() + days);
            }

            value = String(value);

            return (document.cookie = [
                encodeURIComponent(key), '=',
                options.raw ? value : encodeURIComponent(value),
                options.expires ? '; expires=' + options.expires.toUTCString() :
                    '', // use expires attribute, max-age is not supported by IE
                options.path ? '; path=' + options.path : '',
                options.domain ? '; domain=' + options.domain : '',
                options.secure ? '; secure' : ''
                ].join(''));
        }

        // key and possibly options given, get cookie...
        options = value || {};
        var decode = options.raw ? function(s) {return s;} : decodeURIComponent;

        var parts = document.cookie.split('; ');
        for (var i = 0, part; part = parts[i]; i++) {
            var pair = part.split('=');
            if (decode(pair[0]) === key) {
                // IE saves cookies with empty string as "c; ",
                // e.g. without "=" as opposed to EOMB
                return decode(pair[1] || '');
            }
        }
        return null;
    };
})(jQuery);
