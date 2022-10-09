import { createHostRoot,LegacyModel,BlockModel,ConcurrentModel } from '../rm-reconciler/Fiber'
import { updateContainer,synUpdates } from '../rm-reconciler/update'
import { listenToAllSupportedEvents } from './event/DomEventListener'
import { registerEvents } from './event/DomEventPriority'


export function ReactDOMRoot(container: HTMLElement, options?: Object) {
    registerEvents()
    listenToAllSupportedEvents(container);
    this.containerInfo = container
}
ReactDOMRoot.prototype.render = function(element){
    const root = createHostRoot(element,this.containerInfo,ConcurrentModel)
    synUpdates(()=>{
        updateContainer(root)
    })
}


export function ReactDOMBlockingRoot(container: HTMLElement,options?: Object,) {
    registerEvents()
    listenToAllSupportedEvents(container);
    this.containerInfo = container
}
ReactDOMBlockingRoot.prototype.render = function(element){
    const root = createHostRoot(element,this.containerInfo,BlockModel)
    synUpdates(()=>{
        updateContainer(root)
    })
}


export function ReactLegacyRoot(container: HTMLElement,options?: Object){
    registerEvents()
    listenToAllSupportedEvents(container);
    this.containerInfo = container
}
ReactLegacyRoot.prototype.render = function(element){
    const root = createHostRoot(element,this.containerInfo,LegacyModel)
    synUpdates(()=>{
        updateContainer(root)
    })
}

