import { SpeedLog } from '../interface/log'; 
import overrideImage from '../override/image';
import { formatUrl } from '../utils';
// import resourceTiming from './resourceTiming';

let observeDom: MutationObserver;

// 如果支持 resourceTime api， 第一版只上报一次。
export default function (emit: Function) {
    // if (canUseResourceTiming()) {
    //     resourceTiming.getImageLog(emit);
    //     return;
    // }

    overrideImage(emit);

    if (observeDom && observeDom instanceof MutationObserver) {
        observeDom.disconnect();
    }

    // 监听dom变化
    observeDom = new MutationObserver(function (mutations) {
        mutations.forEach(mutation => {
            switch(mutation.type) {
                // dom操作
                case 'childList':
                    const addedNodes = mutation.addedNodes;
                    const addedNodesLength = addedNodes.length || 0;
                    for (let i = 0; i < addedNodesLength; i++) {
                        if (addedNodes[i] instanceof Element) {
                            domChangeHandler(addedNodes[i] as Element, emit);
                        }
                    }
                    break;

                // 属性变化
                case 'attributes': 
                    if(!(mutation.target instanceof Element)) return;
                    
                    if(mutation.attributeName === 'src' && mutation.target instanceof HTMLImageElement) {
                        domChangeHandler(mutation.target, emit);
                    } else {
                        // TODD 需要判断修改前后是否有改动到background-images
                        const backgroundImage = getComputedStyle(mutation.target).backgroundImage;
                        if(!backgroundImage || backgroundImage === 'none') return;

                        attributeChangeHandler(mutation, backgroundImage);
                    }
                    break;
            }
        })
    })

    observeDom.observe(document, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeOldValue: true,
        attributeFilter: ['src', 'style', 'class']
    })
}

function domChangeHandler (e: Element, emit: Function) {
    // 之所以不能等于当前location.href，是因为在chrome中如果src没赋值，会默认取到location.href
    if(e instanceof HTMLImageElement && e.src && e.src !== location.href) {
        // img且有src属性
        const speedLog: SpeedLog = {
            url: formatUrl(e.src),
            method: 'get',
            ret: 0,
            status: 200
        }
        const sendTime = Date.now();
        e.addEventListener('load', () => {
            speedLog.duration = Date.now() - sendTime;
            emit(speedLog);
        });

        e.addEventListener('error', () => {
            speedLog.ret = -1;
            speedLog.status = 400;
            speedLog.duration = Date.now() - sendTime;
            emit(speedLog);
        });

    } else if (e instanceof HTMLScriptElement && e.src && e.src !== location.href) {
        // script且有src属性
        debugger;
    } else {
        // TODO 这里可能会有点耗性能
        // 标签有background-image
        const backgroundImage = getComputedStyle(e).backgroundImage;
        if(!backgroundImage || backgroundImage === 'none') return;
        // 创建改写过的Image实例触发图片测速
        let url = backgroundImage.replace(/^url\("/, '').replace(/"\)$/,'');
        new Image().src = url;
    }
}

// 新建一个游离的div用来获取属性修改之前的background-image
const div = document.createElement('div');
function attributeChangeHandler (mutation: MutationRecord, newBackgroundImage: string) {
    const attributeName = mutation.attributeName;
    div.setAttribute(attributeName, mutation.oldValue);
    const beforeBackgroundImage = window.getComputedStyle(div).backgroundImage;

    if(beforeBackgroundImage !== newBackgroundImage) {
        let url = newBackgroundImage.replace(/^url\("/, '').replace(/"\)$/,'');
        new Image().src = url;
    }

    div.setAttribute(attributeName, '');
}