
import { ReactDOMRoot,ReactDOMBlockingRoot,ReactLegacyRoot } from './domRoot'


export const render = function(element, container) {
   const root = new ReactLegacyRoot(container)
   root.render(element)
};


export const createBlockingRoot = function(element){
    return new ReactDOMBlockingRoot(element)
}


export const createRoot = function(element){
    return new ReactDOMRoot(element)
}

