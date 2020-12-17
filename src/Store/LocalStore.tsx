import produce from "immer";
import React, { useEffect } from "react";
import create from "zustand";
import { Track, useConferenceStore, User } from "./ConferenceStore";
import { useConnectionStore } from "./ConnectionStore";
import { throttle } from "lodash"
import { localTrackOptions } from "../components/JitsiConnection/options";



///LocalStore has dependency on ConferenceStore.
///This component provides the communication from ConferenceStore to LocalStore.
export const LocalStoreLogic = () => {

  const conference = useConferenceStore(state => state.conferenceObject)
  const calculateVolumes = useConferenceStore((store) => store.calculateVolumes)
  const { setMyID, setLocalTracks, pos,  id : myId } = useLocalStore()
  const jsMeet = useConnectionStore(store => store.jsMeet)
  // const pos = useLocalStore((store) => store.pos)
  
  useEffect(()=>{
    if(conference?.myUserId()) setMyID(conference.myUserId())
    
    //initialize the intial position of this user for other users
    if(conference)throttledSendPos(pos)
  },[conference])
  
  useEffect(() => {
      jsMeet
        ?.createLocalTracks({ devices: [ 'audio', 'video' ] }, true)
        .then(tracks => {setLocalTracks(tracks)})
        .catch(error => {
          console.log(error)
        });
  },[ jsMeet, setLocalTracks ])



  function sendPositionToPeers(pos) {
    conference?.sendCommand("pos", { value: pos })
  }

  const throttledSendPos = throttle(sendPositionToPeers, 200)

  useEffect(()=>{
    const newPos = JSON.stringify({...pos, id: myId})
    throttledSendPos(newPos)
    calculateVolumes(pos)
  },[pos])
  
  return <></>
}

type Point = {x:number, y:number}

type Store = {
  setLocalPosition: (newPosition:Point) => void
  setLocalTracks: (tracks:Track[]) => void
  toggleMute: () => void
  clearLocalTracks: () => void
  setMyID: (id:string) => void
} & User

export const useLocalStore = create<Store>((set,get) => {

  const state = {
    id:"",
    mute:false,
    volume:1,
    pos:localTrackOptions.user.initialPosition,
    video:undefined,
    audio:undefined
  }

  // # Private Functions
  const _produceAndSet = (callback:(newState:Store)=>void)=>set(state => produce(state, newState => callback(newState)))

  
  // # Public Functions
  const setLocalPosition = newPosition => set({pos:newPosition})
  
  const toggleMute = () => {
    const audioTrack = get().audio
    if(!audioTrack) return
    if(audioTrack.isMuted()) {
      audioTrack.unmute()
      set({mute:false})
    } else {
      audioTrack.mute()
      set({mute:true})
    }
  }

  const setLocalTracks =  tracks => _produceAndSet(newState=>{
    const audioTrack = tracks.find(t=>t.getType() === 'audio')
    const videoTrack = tracks.find(t=>t.getType() === 'video')
    newState.video = videoTrack
    newState.audio = audioTrack
  })

  const clearLocalTracks = () => _produceAndSet(newState=>{
    newState.audio?.dispose()
    newState.video?.dispose()
    newState.audio=undefined
    newState.video=undefined
  })

  const setMyID = (id:string) => set({id:id})

  return {
  ...state,
  setLocalPosition,
  setLocalTracks,
  toggleMute,
  clearLocalTracks,
  setMyID,
}
})
