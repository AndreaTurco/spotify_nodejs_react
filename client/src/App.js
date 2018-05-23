import React, {Component} from 'react';
import './App.css';
import SpotifyWebApi from 'spotify-web-api-js';
import 'whatwg-fetch';
import Script from 'react-load-script'

const spotifyApi = new SpotifyWebApi();

class App extends Component {
    constructor() {
        super();
        const params = this.getHashParams();
        console.log(params);
        const token = params.access_token;
        if (token) {
            spotifyApi.setAccessToken(token);
            this.handleNewPlayer(this);
        }else{
            //if token are not generated let's do a login
            window.location = 'http://localhost:8888/login';
        }
        this.state = {
            token : params,
            loggedIn: token ? true : false,
            nowPlaying: {name: 'Not Checked', albumArt: ''},
            play_resume: 'PLAY/PAUSE',
            device_id: '',
            device_id_local: '',
            recent_tracks : [],
        }

    }

    handleScriptLoad = () => {
        return new Promise(resolve => {
            if (window.Spotify) {
                resolve();
            } else {
                window.onSpotifyWebPlaybackSDKReady = resolve;
            }
        });
    };

    handleNewPlayer = () => {
        this.handleScriptLoad().then( () => {
            const player = new window.Spotify.Player({
                name: 'Web_Play SDK Spindox',
                getOAuthToken: cb => {
                    cb(this.state.token.access_token);
                }
            });

            // Error handling
            player.addListener('initialization_error', ({message}) => {
                console.error(message);
            });
            player.addListener('authentication_error', ({message}) => {
                console.error(message);
            });
            player.addListener('account_error', ({message}) => {
                console.error(message);
            });
            player.addListener('playback_error', ({message}) => {
                console.error(message);
            });

            // Playback status updates
            player.addListener('player_state_changed', state => {
                console.log(state);
            });

            // Ready
            player.addListener('ready', ({device_id}) => {
                console.log('Ready with Device ID', device_id);
                this.setState({
                    device_id_local: device_id
                });
            });

            // Not Ready
            player.addListener('not_ready', ({device_id}) => {
                console.log('Device ID has gone offline', device_id);
                this.setState({
                    device_id_local: ''
                });
            });

            // Connect to the player!
            player.connect();
        }, (err) => {
            console.error(err);
            this.refreshToken(err, this.handleNewPlayer.bind(this));
        });
    };

    //get the tokens data
    getHashParams() {
        var hashParams = {};
        var e, r = /([^&;=]+)=?([^&;]*)/g,
            q = window.location.hash.substring(1);
        e = r.exec(q)
        while (e) {
            hashParams[e[1]] = decodeURIComponent(e[2]);
            e = r.exec(q);
        }
        return hashParams;
    }

    getNowPlaying() {
        spotifyApi.getMyCurrentPlaybackState()
            .then((response) => {
                this.setState({
                    nowPlaying: {
                        name: response.item.name,
                        albumArt: response.item.album.images[0].url,
                    },
                    device_id: response.device.id
                });
            },
            (err) => {
                console.error(err);
                this.refreshToken(err, this.getNowPlaying.bind(this));
            })
    }

    playResumeCurrentSong() {
        spotifyApi.play({device_id: this.state.device_id_local})
            .then((response) => {
                this.setState({
                    nowPlaying: {
                        play_resume: 'Resume',
                    }
                });
            },
            (err) => {
                console.error(err);
                this.refreshToken(err, this.playResumeCurrentSong.bind(this));
            })
    }

    transferPlayer() {
        spotifyApi.transferMyPlayback(
            [this.state.device_id_local]
            // this.state.device_id_local, { "uris": [ "spotify:track:" + this.state.recent_tracks[0].track.id ]}
        )
        .then((response) => {
            console.log(response);
        },
        (err) => {
            console.error(err);
            this.refreshToken(err, this.transferPlayer.bind(this));
        })
    }

    getMyDevices() {
        spotifyApi.getMyDevices()
            .then((response) => {
                console.log(response);
                this.setState({
                    device_id: response.devices[0].id
                });
            },
            (err) => {
                console.error(err);
                this.refreshToken(err, this.getMyDevices.bind(this));
            })
    }

    skipToPrevious (){
        spotifyApi.skipToPrevious()
            .then(this.state.device_id_local,
                (err) => {
                    console.error(err);
                    this.refreshToken(err, this.skipToPrevious.bind(this));
                });
    }

    skipToNext (){
        spotifyApi.skipToNext().then(this.state.device_id_local,
            (err) => {
                console.error(err);
                this.refreshToken(err, this.skipToNext.bind(this));
            });
    }

    pause (){
        spotifyApi.pause().then(null,
            (err) => {
                console.error(err);
                this.refreshToken(err, this.pause.bind(this));
            });
    }

    getMyRecentlyPlayedTracks (){
        spotifyApi.getMyRecentlyPlayedTracks()
            .then((response) => {
                console.log(response);
                this.setState({
                    recent_tracks : response.items
                });
            },
            (err) => {
                console.error(err);
                this.refreshToken(err, this.getMyRecentlyPlayedTracks.bind(this));
            });
    }

    refreshToken (err, callback){
        if(err.status !== 401) return;
        fetch('http://localhost:8888/refresh_token?refresh_token='+ this.state.token.refresh_token)
            .then( response => {
                response.json()
                    .then((json) => {
                        console.log(json.access_token);
                        spotifyApi.setAccessToken(json.access_token);
                        this.setState({
                            token : {
                                access_token : json.access_token
                            }
                        });
                        callback();
                    });
            }).catch(function (ex) {
            console.log('parsing failed', ex)
            alert('failed during refresh token action');
        })
    }

    render() {
        const tracks_list = this.state.recent_tracks.map( (item, index ) => <li key={index}>{item.track.href}</li> );
        const spotifySDKsrc = <Script url="https://sdk.scdn.co/spotify-player.js" />;

        return (
            <div className='App'>
                {spotifySDKsrc}
                <a href='http://localhost:8888/login'> Login to Spotify </a>
                <div>
                    Now Playing: {this.state.nowPlaying.name}
                </div>
                <div>
                    <img src={this.state.nowPlaying.albumArt} style={{height: 150}}/>
                </div>
                <p>
                    {this.state.loggedIn &&
                    <button onClick={() => this.getNowPlaying()}>
                        Check Now Playing
                    </button>
                    }
                </p>
                <p></p>
                <p>
                    <button onClick={() => this.skipToPrevious()}>
                        skipToPrevious
                    </button>
                    <button onClick={() => this.transferPlayer()}>
                        Play
                    </button>
                    <button onClick={() => this.playResumeCurrentSong()}>
                        Play/resume
                    </button>
                    <button onClick={() => this.pause()}>
                        Pause
                    </button>
                    <button onClick={() => this.skipToNext()}>
                        skipToNext
                    </button>
                </p>
                <p>
                    <button onClick={() => this.getMyDevices()}>
                        getMyDevices
                    </button>
                </p>
                <p>
                    <button onClick={() => this.getMyRecentlyPlayedTracks()}>
                        getMyRecentlyPlayedTracks
                    </button>
                </p>
                <p>
                    Device id: {this.state.device_id}
                </p>
                <p>
                    Local Device id: {this.state.device_id_local}
                </p>
                <div>
                    <ul>
                        {tracks_list}
                    </ul>
                </div>
            </div>
        );
    }
}

export default App;
