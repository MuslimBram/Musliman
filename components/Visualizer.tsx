import React from 'react';
import { WorkflowDef, WorkflowNode } from '../types';
import { Activity, Globe, MessageSquare, Phone, Server, Share2, Zap } from 'lucide-react';

interface VisualizerProps {
  workflow: WorkflowDef;
  activeNodeId?: string;
}

const NodeIcon = ({ type }: { type: WorkflowNode['type'] }) => {
  switch (type) {
    case 'trigger': return <Zap className="w-4 h-4 text-yellow-400" />;
    case 'ai': return <Activity className="w-4 h-4 text-purple-400" />;
    case 'router': return <Share2 className="w-4 h-4 text-blue-400" />;
    case 'app': return <Server className="w-4 h-4 text-green-400" />;
    default: return <Globe className="w-4 h-4 text-gray-400" />;
  }
};

export const Visualizer: React.FC<VisualizerProps> = ({ workflow, activeNodeId }) => {
  return (
    <div className="w-full h-full bg-[#181818] rounded-xl overflow-hidden relative flex flex-col items-center justify-center p-8 border border-gray-800">
      <div className="absolute top-4 left-4 text-sm text-gray-500 font-mono">
        n8n_canvas_v2.0 :: {workflow.name}
      </div>

      {/* Simple Flex-based Tree for visualization */}
      <div className="flex flex-col gap-8 items-center w-full max-w-4xl">
        
        {/* Render nodes in a simple sequential or branched layout (simplified for display) */}
        {workflow.nodes.map((node, index) => {
          const isActive = activeNodeId === node.id;
          const isNext = index < workflow.nodes.length - 1;

          return (
            <React.Fragment key={node.id}>
              <div 
                className={`
                  relative z-10 flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all duration-300 w-64
                  ${isActive 
                    ? 'border-n8n-primary bg-n8n-primary/10 shadow-[0_0_15px_rgba(255,109,90,0.3)] scale-105' 
                    : 'border-gray-700 bg-[#222] hover:border-gray-600'}
                `}
              >
                <div className={`p-2 rounded-full bg-black/30`}>
                  <NodeIcon type={node.type} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-200">{node.label}</span>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">{node.type}</span>
                </div>
                
                {/* Status Indicator */}
                {isActive && (
                   <span className="absolute -right-2 -top-2 w-4 h-4 flex items-center justify-center">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-n8n-primary opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-2 w-2 bg-n8n-primary"></span>
                   </span>
                )}
              </div>

              {/* Connector Line */}
              {isNext && (
                <div className="h-8 w-0.5 bg-gray-700 relative">
                   {/* Animated flow particle if active */}
                   {isActive && (
                     <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-3 bg-n8n-primary blur-[2px] animate-pulse"></div>
                   )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};