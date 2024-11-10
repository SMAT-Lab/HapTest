<pre class="pseudocode" data-line-number=true>
\begin{algorithm}
\caption{PtgNaiveSearchPolicy GenerateEvent}
\begin{algorithmic}
\PROCEDURE{GenerateEvent}{$currentState, pageMap, stateMap$}
    \STATE \CALL{UpdateState}{$currentState, pageMap, stateMap$}
    \STATE $components = stateMap[currentState.stateSig]$
    
    \STATE events = \CALL{BuildUnexploredEvents}{components} // 当前状态下未执行过的事件
    \STATE \CALL{SortEventByRank}{events} // 基于优先级排序
    \IF{levents.length > 0}
        \RETURN events[0]   // 返回优先级最高的事件
    \ENDIF

    \FOR{\textbf{each} $state$ \textbf{in}  \CALL{PTG.getReachableStates}{currentState}}
        \IF{\CALL{IsExplored}{state}} 
            \CONTINUE 
        \ENDIF 
        \STATE steps = \CALL{PTG.getNavigationSteps}{currentState, state} //  返回跳转到此状态最短路径的第1个事件
        \RETURN steps[0]
    \ENDFOR

    \RETURN null
\ENDPROCEDURE

\PROCEDURE{UpdateState}{$currentState, pageMap, stateMap$}
    \STATE $pageKey = currentState.pageKey$
    \IF{\CALL {IsNewPage}{pageKey}}
        \STATE $pageMap[pageKey] = new$ $Set()$
    \ENDIF

    \STATE $stateSets = pageMap[pageKey]$
    \STATE $sig = currentState.stateSig$
    \IF{$sig$ \textbf{not} \textbf{in} $stateSets$}
        \STATE $stateSets.add(sig)$
        \STATE components = \CALL{FilterHasUIEventComponents}{currentState}
        \STATE \CALL{UpdateRank}{components}
        \STATE $stateMap[sig] = components$
    \ENDIF
\ENDPROCEDURE
\end{algorithmic}
\end{algorithm}
</pre>
