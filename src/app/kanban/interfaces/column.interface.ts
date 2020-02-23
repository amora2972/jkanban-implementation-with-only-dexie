import {ITicket} from './ticket.interface';

export interface IColumn {
  id?: any;
  title: string;
  item?: ITicket[];
  class?: string;
  totalTicketsLeft?: number;
}
