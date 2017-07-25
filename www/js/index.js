/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */


/*
    Сейчас Quiz - это заточка под людей шри,
    можно было написать более универсально. Например, эдакий абстрактный модуль для тестирования.
    TODO: Брать людей из бота
    TODO: Обернуть _state в геттеры/сеттеры
    TODO: Кнопка "начать заново" появится в конце теста
    TODO: Заменить нотивный диалог с результатами на более красивый кастомный "экран"
 */
(function(window, undefined) {

    var COMPLIMENTS = ['Молодец!', 'Гениально!', 'Верно!', 'Красава!', 'Молоток ;)', 'Ииииха!', 'Супер!', 'Продолжай в том же духе!'];
    var ABUSES = ['Неа... (', 'Неправильно! ;(', 'Не совсем!', 'Упс, неа :)', 'Святаааая корова!', 'Да как так-то а?', 'Стыдно, товарисч!'];

    this.Quiz = function(appLayout, peopleData) {
        this._peopleData = peopleData||[];

        this._lastResultsMsg = '';

        this._state = {
            currQuestNum: -1,
            correctAnswer:"",
            canGoToNextQuestion: true
        }

        this._results = {
            correct: 0,
            mistakes: 0,
            all: 0
        }

        __build.call(this);
        __bindEvents.call(this);
    }

    /**
     *  Public methods
     */

    Quiz.prototype = {
        destroy: function() {},

        play: function () {
            // Перемешаем массив с людьми, чтобы последовательность вопросов не повторялась
            __shuffleArray(this._peopleData);
            this._results.all = this._peopleData.length;

            this._state.canGoToNextQuestion = true;

            this._resetKarma();
            this.nextQuestion();
        },

        nextQuestion: function() {
        
            // Last question?
            if (this._state.currQuestNum >= this._peopleData.length-1) {
                // Results Dialog
                // TODO: Вынести шаблон сообщения в константы
                // TODO: Заменить текст на картинку с результатами
                this._lastResultsMsg = 'Из ' + this._peopleData.length + ' вопросов:\n' 
                            + '- правильных: ' + this._results.correct + '\n'
                            + '- ошибок: ' + this._results.mistakes; 

                this._state.canGoToNextQuestion = false;

                if (undefined != navigator.notification) {
                    navigator.vibrate([200,400,200,400,300]);
                    navigator.notification.confirm(
                        this._lastResultsMsg,   
                        this._onResultsPrompt.bind(this),       
                        'Тест завершен!', 
                       ['Го снова!', 'Поделиться']                  
                    );
                } else {
                    alert('Error: navigator.notification.confirm is undefined');
                }
                return false;
            }

            this._state.currQuestNum++;


            // Вопрос
            var item = this._peopleData[ this._state.currQuestNum ];
            // 4 случайных ответа
            var randAnswersArr = __getRandNElemsFromArr(this._peopleData, 4);

            // - Если в случайных ответах нет правильного, тогда подмешиваем 
            // правильный ответ в рандомную позицию
            // - Если в рандомных ответах уже есть правильный, то ничего не делаем
            if (undefined === __findObjInArray("name", item.name, randAnswersArr)) {
                var rndIdx = Math.floor(Math.random()*randAnswersArr.length);
                randAnswersArr[ rndIdx ] = item;
            }


            // Угадай кто на фото?
            this._setPhoto( item.photo );
            // Варианты ответа
            this._clearAnswers();
            this._addAnswers( randAnswersArr );
            this._refreshQuestNumberLabel();

            this._state.correctAnswer = item.name;


            // console.log('correct answer: ', this._state.correctAnswer);
        },

        restart: function () {
            this._state.currQuestNum = -1; 
            navigator.vibrate(100);
            this.play();
        },

        _handleAnswer: function (answerValue) {

            var isCorrect = answerValue === this._state.correctAnswer;
            var text = isCorrect ? __getRandNElemsFromArr(COMPLIMENTS, 1) : __getRandNElemsFromArr(ABUSES, 1); 

            // TODO: calc correct / mistakes for result

            this._resolveKarma(isCorrect);

            if (false === isCorrect) {
                // Подсвечиваем неверный ответ
                this.answersHolder.querySelector('.quiz-answers__item[data-value="'+answerValue+'"]').classList.add('quiz-answers__item_mistake');
                navigator.vibrate(400);
            }

            // ПОдсвечиваем верный ответ
            this.answersHolder.querySelector('.quiz-answers__item[data-value="'+this._state.correctAnswer+'"]').classList.add('quiz-answers__item_correct');

            this._state.canGoToNextQuestion = false;

            setTimeout(function () {

                var successCallback = function(result) {
                    if ('hide' === result.event) {
                        this.nextQuestion();
                        this._state.canGoToNextQuestion = true;
                        // TODO: vibrate, if incorrect
                    }
                }

                this._showToast(
                    text,
                    isCorrect, 
                    successCallback,
                    function() {
                        // TODO: handle errors
                    }
                );

            }.bind(this), 1000);
        },

        _resetKarma: function() {
            this._results.correct = 0;
            this._results.mistakes = 0;
        },

        _resolveKarma: function(isCorrect) {
            if (true === isCorrect) {
                this._results.correct++;
                return;
            }

            this._results.mistakes++;
        },

        _refreshQuestNumberLabel: function () {
            this.questCounter.innerHTML = (this._state.currQuestNum+1) + '/' + this._peopleData.length + ' —&nbsp;';
        },

        _showToast: function (text, isCorrect, success, fail) {
            if (window.plugins.toast) {
                window.plugins.toast.showWithOptions(
                    {
                        message: text,
                        duration: 2000, // 2000 ms 
                        position: "center",
                        styling: {
                            opacity: 0.80, // 0.0 (transparent) to 1.0 (opaque). Default 0.8 
                            backgroundColor: isCorrect ? '#95db3b' : '#ff1e74', // make sure you use #RRGGBB. Default #333333 
                            textColor: '#FFFFFF', // Ditto. Default #FFFFFF 
                            textSize: 30, // Default is approx. 13. 
                            cornerRadius: 8, // minimum is 0 (square). iOS default 20, Android default 100 
                            horizontalPadding: 40, // iOS default 16, Android default 50 
                            verticalPadding: 16 // iOS default 12, Android default 30 
                        }
                    },
                    //Success callback 
                    success.bind(this), 
                    fail.bind(this)
                );
            }
        },


        _addAnswers: function (answersArr) {
            var frag = document.createDocumentFragment();

            for (var i in answersArr) {
                this.questText = document.createElement('div');
                this.questText.className = 'quiz-answers__item';
                this.questText.innerHTML = answersArr[i].name;
                this.questText.setAttribute('data-value', answersArr[i].name);
                this.answersHolder.appendChild(this.questText);
                frag.appendChild(this.questText);
            }

            this.answersHolder.appendChild(frag);
        },  


        _clearAnswers: function () {
            this.answersHolder.innerHTML = '';
        },

        _setPhoto: function (src) {
            this.photo.src = src;
        },


        _onResultsPrompt: function (btnIndex) {
            switch (btnIndex) {
                case 1: 
                    this.restart();
                    break;
                case 2:
                    // share
                    if (undefined === window.plugins.socialsharing) {
                        return false;
                    }
                    
                    // TODO: переделать поудобнее - на экране с результатами сделать кнопку Начать заново
                    this.restart();

                    window.plugins.socialsharing.shareWithOptions(
                        {
                            message: this._lastResultsMsg
                        }, 
                        this._onShareSuccess,
                        function (){
                            alert('Ошибка. Не удалось поделиться (');
                        }
                    );

                    return false;
                    break;
                default:
                    this.restart();
            }
        },

        _onShareSuccess: function () {
           // this.restart();
        },

        _eventHandler: function (event) {

            if ( !this._state.canGoToNextQuestion) {
                return false;
            }

            var targetClass = event.target.className;

            switch (targetClass) {
                case 'quiz-answers__item':
                    // Handle answer
                    var value = event.target.getAttribute('data-value');
                    this._handleAnswer(value);     
                    break;
            }
        }
    }




    /**
     * Private methods
     */ 

    function __bindEvents() {
        // TODO: pointer events support | make browser events ready
        this.layout.addEventListener('click', this._eventHandler.bind(this));
    }

    function __build() {
        // Layout
        this.layout = document.createElement('div');
        this.layout.className = 'quiz';

        // Photo holder
        this.photoHolder = document.createElement('div');
        this.photoHolder.className = 'quiz-photo-placeholder';

        // Photo inside photo holder
        this.photo = new Image();
        this.photo.className = 'quiz-photo-placeholder__image';
        this.photoHolder.appendChild(this.photo);
        this.layout.appendChild(this.photoHolder);

        // Question
        this.questHolder = document.createElement('div');
        this.questHolder.className = 'quiz-quest';

        this.questText = document.createElement('h1');
        this.questText.className = 'quiz-quest__title';
        
        this.questCounter = document.createElement('span');
        this.questCounter.className = 'quiz-title__counter';
        this.questText.appendChild(this.questCounter);

        this.questQuestion = document.createElement('span');
        this.questQuestion.innerHTML = 'Кто это? ;)';
        this.questText.appendChild(this.questQuestion);


        this.questHolder.appendChild(this.questText);
        this.layout.appendChild(this.questHolder);

        this.answersHolder = document.createElement('div');
        this.answersHolder.className = 'quiz-answers';
        //
        this.layout.appendChild(this.answersHolder);


       /* 
        this.locker = document.createElement('div');
        this.locker.className = 'quiz-locker';
        this.locker.style.display = 'none';

        this.btnRestart = document.createElement('button');
        this.btnRestart.className = 'quiz-btn-restart';
        this.btnRestart.innerHTML = 'Го снова!';

        this.layout.appendChild(this.locker);
        */

        // Inject to document
        document.body.appendChild( this.layout );
    }


    function __addClass(elem, _className) {
        if (-1 === elem.className.indexOf(_className)) {
            elem.className = [elem.className, _className].join(' ');
        }
    }

    function __removeClass(elem, _className) {
        var newClasses = [],
            i,
            classes = elem.className.split(" ");

        for (i = 0; i < classes.length; i++) {
            if (classes[i] !== _className) {
                newClasses.push(classes[i]);
            }
        }
        elem.className = newClasses.join(' ');
    }


    function __findObjInArray(field, value, arr) {
        var i, 
            l = arr.length;

        for (i=0; i < l; i++) {
            if (arr[i][field] === value) {
                return arr[i];
            }
        }
    }


    /**
     * Shuffles array in place.
     * @param {Array} a items The array containing the items.
     */
    function __shuffleArray(a) {
        var j, x, i;
        for (i = a.length; i; i--) {
            j = Math.floor(Math.random() * i);
            x = a[i - 1];
            a[i - 1] = a[j];
            a[j] = x;
        }
    }


    // TODO: Быстрое решение, позже, к нему стоит вернуться
    // https://stackoverflow.com/questions/19269545/how-to-get-n-no-elements-randomly-from-an-array
    function __getRandNElemsFromArr(arr, n) {
        var result = new Array(n),
            len = arr.length,
            taken = new Array(len);
        if (n > len)
            throw new RangeError("getRandom: more elements taken than available");
        while (n--) {
            var x = Math.floor(Math.random() * len);
            result[n] = arr[x in taken ? taken[x] : x];
            taken[x] = --len;
        }
        return result;
    }

}(window));


var app = {
    // Application Constructor
    initialize: function() {

        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);

        // document.addEventListener("pause", onPause, false);
        // document.addEventListener("resume", onResume, false);

        this.appLayout = document.querySelector('.app');

        // Прикльно было бы забирать данные из бота
        this.quiz = new Quiz(this.appLayout, PeopleData.shri);
    },


    onDeviceReady: function() {

        if (cordova.platformId == 'android') {
            StatusBar.backgroundColorByHexString("#ff0f37");
        }
        
        if (cordova.platformId == 'ios') {
            StatusBar.overlaysWebView(true);
        }

        // Autoplay in mvp
        // TODO: Тут я немного сделал не то, а именно, внес все в quiz, 
        // и получается, что он как бы самостоятельная такая единица - очень "толстая"
        // Сначала хотел сделать такую архитектуру, что на каждую страничку будет свой "большой" объект
        // который будет сам строить свой дом и будет знать о нем все, вся логика страницы будет инкапсулирована в ней
        // Подобно новому activity.
        // Потребуется рефакторинг
        this.quiz.play();

        // TODO: 
        // - app: statistic bar
        // - app: normal results screen
        // - app: restart button on results screen
        // - quiz: animations
    }
};

app.initialize();