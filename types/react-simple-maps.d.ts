declare module "react-simple-maps" {
  import { ReactNode, SVGProps, MouseEvent } from "react";

  export interface ProjectionConfig {
    center?: [number, number];
    scale?: number;
    rotate?: [number, number, number];
    parallels?: [number, number];
  }

  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: ProjectionConfig;
    width?: number;
    height?: number;
    style?: React.CSSProperties;
    className?: string;
    children?: ReactNode;
  }

  export interface GeographiesProps {
    geography: string | object;
    children: (props: { geographies: Geography[]; projection: unknown }) => ReactNode;
  }

  export interface Geography {
    rsmKey: string;
    properties: Record<string, unknown>;
    geometry: object;
    type: string;
  }

  export interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: Geography;
    style?: {
      default?: React.CSSProperties;
      hover?: React.CSSProperties;
      pressed?: React.CSSProperties;
    };
    onMouseEnter?: (event: MouseEvent<SVGPathElement>) => void;
    onMouseLeave?: (event: MouseEvent<SVGPathElement>) => void;
    onClick?: (event: MouseEvent<SVGPathElement>) => void;
  }

  export interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    onMoveStart?: (position: { coordinates: [number, number]; zoom: number }, event: unknown) => void;
    onMove?: (position: { x: number; y: number; zoom: number; dragging: boolean }, event: unknown) => void;
    onMoveEnd?: (position: { coordinates: [number, number]; zoom: number }, event: unknown) => void;
    translateExtent?: [[number, number], [number, number]];
    className?: string;
    style?: React.CSSProperties;
    children?: ReactNode;
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element;
  export function Geographies(props: GeographiesProps): JSX.Element;
  export function Geography(props: GeographyProps): JSX.Element;
  export function ZoomableGroup(props: ZoomableGroupProps): JSX.Element;
}
